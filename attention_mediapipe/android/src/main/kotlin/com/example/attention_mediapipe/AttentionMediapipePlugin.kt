package com.example.attention_mediapipe

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import android.media.Image
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import org.opencv.android.OpenCVLoader
import org.opencv.calib3d.Calib3d
import org.opencv.core.CvType
import org.opencv.core.Mat
import org.opencv.core.MatOfDouble
import org.opencv.core.MatOfPoint2f
import org.opencv.core.MatOfPoint3f
import org.opencv.core.Point
import org.opencv.core.Point3
import io.flutter.embedding.engine.plugins.FlutterPlugin
import io.flutter.embedding.engine.plugins.activity.ActivityAware
import io.flutter.embedding.engine.plugins.activity.ActivityPluginBinding
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.util.ArrayDeque
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

class AttentionMediapipePlugin : FlutterPlugin, MethodChannel.MethodCallHandler,
  EventChannel.StreamHandler, ActivityAware, DefaultLifecycleObserver {

  private lateinit var methodChannel: MethodChannel
  private lateinit var eventChannel: EventChannel
  private var eventSink: EventChannel.EventSink? = null

  private var appContext: Context? = null
  private var activityBinding: ActivityPluginBinding? = null

  private var cameraProvider: ProcessCameraProvider? = null
  private var analysisUseCase: ImageAnalysis? = null
  private var analysisExecutor: ExecutorService? = null
  private var cameraExecutor: ExecutorService? = null

  private var faceLandmarker: FaceLandmarker? = null
  private var running = false
  private var debug = false
  private var fps = 10
  private var lastFrameMs = 0L
  private var inferenceBusy = false
  private var openCvReady = false
  private var lastFrameWidth = 0
  private var lastFrameHeight = 0

  private val emaAlpha = 0.2
  private var ema = 0.0
  private val emaWindow = ArrayDeque<Pair<Long, Double>>()

  private var baselineGazeX = 0.0
  private var baselineGazeY = 0.0
  private var baselineEar = 0.18
  private var isCalibrating = false
  private var calibrationStartMs = 0L
  private val calibrationGazeX = mutableListOf<Double>()
  private val calibrationGazeY = mutableListOf<Double>()
  private val calibrationEar = mutableListOf<Double>()

  private val gazeNoiseWindow = ArrayDeque<Pair<Long, Pair<Double, Double>>>()

  override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    appContext = binding.applicationContext
    methodChannel = MethodChannel(binding.binaryMessenger, "attention_mediapipe/methods")
    eventChannel = EventChannel(binding.binaryMessenger, "attention_mediapipe/events")
    methodChannel.setMethodCallHandler(this)
    eventChannel.setStreamHandler(this)
    ProcessLifecycleOwner.get().lifecycle.addObserver(this)
    loadBaseline()
  }

  override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {
    methodChannel.setMethodCallHandler(null)
    eventChannel.setStreamHandler(null)
    ProcessLifecycleOwner.get().lifecycle.removeObserver(this)
    stopInternal()
  }

  override fun onAttachedToActivity(binding: ActivityPluginBinding) {
    activityBinding = binding
  }

  override fun onDetachedFromActivity() {
    activityBinding = null
  }

  override fun onReattachedToActivityForConfigChanges(binding: ActivityPluginBinding) {
    activityBinding = binding
  }

  override fun onDetachedFromActivityForConfigChanges() {
    activityBinding = null
  }

  override fun onStart(owner: LifecycleOwner) {
    if (running) startInternal()
  }

  override fun onStop(owner: LifecycleOwner) {
    stopCamera()
  }

  override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
    when (call.method) {
      "start" -> {
        fps = (call.argument<Int>("fps") ?: 10).coerceIn(5, 30)
        debug = call.argument<Boolean>("debug") ?: false
        running = true
        startInternal()
        result.success(null)
      }
      "stop" -> {
        running = false
        stopInternal()
        result.success(null)
      }
      "startCalibration" -> {
        startCalibration()
        result.success(null)
      }
      "finishCalibration" -> {
        val summary = finishCalibration()
        result.success(summary)
      }
      else -> result.notImplemented()
    }
  }

  override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
    eventSink = events
  }

  override fun onCancel(arguments: Any?) {
    eventSink = null
  }

  private fun startCalibration() {
    isCalibrating = true
    calibrationStartMs = System.currentTimeMillis()
    calibrationGazeX.clear()
    calibrationGazeY.clear()
    calibrationEar.clear()
  }

  private fun finishCalibration(): Map<String, Any> {
    isCalibrating = false
    val meanX = calibrationGazeX.averageOrZero()
    val meanY = calibrationGazeY.averageOrZero()
    val stdX = calibrationGazeX.stddev()
    val stdY = calibrationGazeY.stddev()
    val earMean = calibrationEar.averageOrZero()
    val earStd = calibrationEar.stddev()
    baselineGazeX = meanX
    baselineGazeY = meanY
    if (earMean > 0.0) baselineEar = max(0.18, earMean - earStd)
    saveBaseline(meanX, meanY, earMean, earStd)
    return mapOf(
      "meanX" to meanX,
      "meanY" to meanY,
      "stdX" to stdX,
      "stdY" to stdY,
      "earMean" to earMean,
      "earStd" to earStd,
      "tsMs" to System.currentTimeMillis()
    )
  }

  private fun startInternal() {
    if (analysisExecutor == null) analysisExecutor = Executors.newSingleThreadExecutor()
    if (cameraExecutor == null) cameraExecutor = Executors.newSingleThreadExecutor()
    if (!openCvReady) {
      openCvReady = OpenCVLoader.initDebug()
    }
    startCamera()
  }

  private fun stopInternal() {
    stopCamera()
    analysisExecutor?.shutdown()
    cameraExecutor?.shutdown()
    analysisExecutor = null
    cameraExecutor = null
  }

  @SuppressLint("UnsafeOptInUsageError")
  private fun startCamera() {
    val context = appContext ?: return
    val providerFuture = ProcessCameraProvider.getInstance(context)
    providerFuture.addListener({
      cameraProvider = providerFuture.get()
      cameraProvider?.unbindAll()

      val analysis = ImageAnalysis.Builder()
        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        .build()
      analysisUseCase = analysis

      analysis.setAnalyzer(analysisExecutor!!, { imageProxy ->
        handleFrame(imageProxy)
      })

      val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA
      try {
        cameraProvider?.bindToLifecycle(
          activityBinding?.lifecycleOwner ?: ProcessLifecycleOwner.get(),
          cameraSelector,
          analysis
        )
      } catch (e: Exception) {
        Log.e("AttentionMediapipe", "Camera bind failed", e)
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun stopCamera() {
    try {
      cameraProvider?.unbindAll()
    } catch (_: Exception) {}
  }

  private fun handleFrame(imageProxy: ImageProxy) {
    val now = System.currentTimeMillis()
    if (now - lastFrameMs < (1000 / fps)) {
      imageProxy.close()
      return
    }
    if (inferenceBusy) {
      imageProxy.close()
      return
    }
    lastFrameMs = now
    inferenceBusy = true

    val bitmap = imageProxyToBitmap(imageProxy)
    imageProxy.close()

    if (bitmap == null) {
      inferenceBusy = false
      return
    }

    ensureFaceLandmarker()
    lastFrameWidth = bitmap.width
    lastFrameHeight = bitmap.height
    val mpImage = BitmapImageBuilder(bitmap).build()
    val ts = System.currentTimeMillis()
    faceLandmarker?.detectAsync(mpImage, ts)
  }

  private fun ensureFaceLandmarker() {
    if (faceLandmarker != null) return
    val context = appContext ?: return
    val options = FaceLandmarker.FaceLandmarkerOptions.builder()
      .setBaseOptions(
        BaseOptions.builder()
          .setDelegate(Delegate.CPU)
          .setModelAssetPath("face_landmarker.task")
          .build()
      )
      .setRunningMode(RunningMode.LIVE_STREAM)
      .setMinFaceDetectionConfidence(0.6f)
      .setMinFacePresenceConfidence(0.6f)
      .setMinTrackingConfidence(0.6f)
      .setResultListener { result: FaceLandmarkerResult, inputImage ->
        inferenceBusy = false
        processResult(result, inputImage?.timestampMs ?: System.currentTimeMillis())
      }
      .setErrorListener { e ->
        inferenceBusy = false
        Log.e("AttentionMediapipe", "FaceLandmarker error", e)
      }
      .build()
    faceLandmarker = FaceLandmarker.createFromOptions(context, options)
  }

  private fun processResult(result: FaceLandmarkerResult, tsMs: Long) {
    val face = result.faceLandmarks().firstOrNull()
    val facePresent = face != null

    var gazeX = 0.0
    var gazeY = 0.0
    var gazeConfidence = 0.0
    var yawDeg = 0.0
    var pitchDeg = 0.0
    var rollDeg = 0.0
    var eyesOpen = false

    if (facePresent) {
      val landmarks = face!!
      val leftIris = averagePoint(landmarks, intArrayOf(468, 469, 470, 471, 472))
      val rightIris = averagePoint(landmarks, intArrayOf(473, 474, 475, 476, 477))
      val leftEyeCenter = averagePoint(landmarks, intArrayOf(33, 133, 159, 145))
      val rightEyeCenter = averagePoint(landmarks, intArrayOf(362, 263, 386, 374))

      val leftWidth = dist(landmarks[33], landmarks[133])
      val rightWidth = dist(landmarks[362], landmarks[263])
      val leftHeight = dist(landmarks[159], landmarks[145])
      val rightHeight = dist(landmarks[386], landmarks[374])

      val leftGx = (leftIris.x - leftEyeCenter.x) / max(1e-5, leftWidth)
      val rightGx = (rightIris.x - rightEyeCenter.x) / max(1e-5, rightWidth)
      val leftGy = (leftIris.y - leftEyeCenter.y) / max(1e-5, leftHeight)
      val rightGy = (rightIris.y - rightEyeCenter.y) / max(1e-5, rightHeight)

      gazeX = ((leftGx + rightGx) / 2.0).coerceIn(-1.0, 1.0)
      gazeY = ((leftGy + rightGy) / 2.0).coerceIn(-1.0, 1.0)

      val earLeft = eyeAspectRatio(landmarks, intArrayOf(33, 160, 158, 133, 153, 144))
      val earRight = eyeAspectRatio(landmarks, intArrayOf(362, 385, 387, 263, 373, 380))
      val ear = (earLeft + earRight) / 2.0
      eyesOpen = ear > baselineEar

      val pose = estimateHeadPose(landmarks)
      yawDeg = pose.yaw
      pitchDeg = pose.pitch
      rollDeg = pose.roll

      if (isCalibrating) {
        val elapsed = tsMs - calibrationStartMs
        if (elapsed <= 2000) {
          calibrationGazeX.add(gazeX)
          calibrationGazeY.add(gazeY)
          calibrationEar.add(ear)
        }
      }

      val adjustedX = gazeX - baselineGazeX
      val adjustedY = gazeY - baselineGazeY
      gazeX = adjustedX.coerceIn(-1.0, 1.0)
      gazeY = adjustedY.coerceIn(-1.0, 1.0)

      gazeConfidence = computeGazeConfidence(tsMs, gazeX, gazeY)
    }

    val headPoseOk = abs(yawDeg) < 20.0 && abs(pitchDeg) < 15.0
    val gazeForward = abs(gazeX) < 0.22 && abs(gazeY) < 0.22

    val base = (if (facePresent) 1.0 else 0.0) * 0.35 +
      (if (eyesOpen) 1.0 else 0.0) * 0.20 +
      (if (gazeForward) 1.0 else 0.0) * 0.30 +
      (if (headPoseOk) 1.0 else 0.0) * 0.15
    ema = emaAlpha * base + (1 - emaAlpha) * ema
    emaWindow.add(tsMs to ema)
    while (emaWindow.isNotEmpty() && tsMs - emaWindow.first().first > 2000) {
      emaWindow.removeFirst()
    }
    val rollingAvg = if (emaWindow.isNotEmpty()) emaWindow.map { it.second }.average() else ema
    val attentionOk = rollingAvg >= 0.70

    val flags = mutableListOf<String>()
    if (!facePresent) flags.add("NO_FACE")
    if (facePresent && !eyesOpen) flags.add("EYES_CLOSED")
    if (facePresent && !gazeForward) flags.add("LOOK_AWAY")
    if (facePresent && !headPoseOk) flags.add("BAD_POSE")

    val payload = mapOf(
      "tsMs" to tsMs,
      "facePresent" to facePresent,
      "eyesOpen" to eyesOpen,
      "yawDeg" to yawDeg,
      "pitchDeg" to pitchDeg,
      "rollDeg" to rollDeg,
      "gazeX" to gazeX,
      "gazeY" to gazeY,
      "gazeConfidence" to gazeConfidence,
      "attentionConfidence" to rollingAvg,
      "attentionOk" to attentionOk,
      "flags" to flags
    )
    eventSink?.success(payload)
  }

  private fun computeGazeConfidence(ts: Long, gx: Double, gy: Double): Double {
    gazeNoiseWindow.add(ts to (gx to gy))
    while (gazeNoiseWindow.isNotEmpty() && ts - gazeNoiseWindow.first().first > 2000) {
      gazeNoiseWindow.removeFirst()
    }
    if (gazeNoiseWindow.size < 3) return 0.6
    val xs = gazeNoiseWindow.map { it.second.first }
    val ys = gazeNoiseWindow.map { it.second.second }
    val std = sqrt(xs.stddev().pow(2) + ys.stddev().pow(2))
    return (1.0 - (std * 3.0)).coerceIn(0.0, 1.0)
  }

  private fun estimateHeadPose(landmarks: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>): Pose {
    if (!openCvReady || lastFrameWidth <= 0 || lastFrameHeight <= 0) {
      return Pose(0.0, 0.0, 0.0)
    }

    val imagePoints = MatOfPoint2f(
      Point(landmarks[1].x() * lastFrameWidth, landmarks[1].y() * lastFrameHeight),   // nose tip
      Point(landmarks[152].x() * lastFrameWidth, landmarks[152].y() * lastFrameHeight), // chin
      Point(landmarks[33].x() * lastFrameWidth, landmarks[33].y() * lastFrameHeight),   // left eye outer
      Point(landmarks[263].x() * lastFrameWidth, landmarks[263].y() * lastFrameHeight), // right eye outer
      Point(landmarks[61].x() * lastFrameWidth, landmarks[61].y() * lastFrameHeight),   // left mouth
      Point(landmarks[291].x() * lastFrameWidth, landmarks[291].y() * lastFrameHeight)  // right mouth
    )

    val modelPoints = MatOfPoint3f(
      Point3(0.0, 0.0, 0.0),       // nose tip
      Point3(0.0, -63.6, -12.5),   // chin
      Point3(-43.3, 32.7, -26.0),  // left eye outer
      Point3(43.3, 32.7, -26.0),   // right eye outer
      Point3(-28.9, -28.9, -24.1), // left mouth
      Point3(28.9, -28.9, -24.1)   // right mouth
    )

    val focalLength = lastFrameWidth.toDouble()
    val center = Point(lastFrameWidth / 2.0, lastFrameHeight / 2.0)
    val cameraMatrix = Mat(3, 3, CvType.CV_64FC1)
    cameraMatrix.put(
      0, 0,
      focalLength, 0.0, center.x,
      0.0, focalLength, center.y,
      0.0, 0.0, 1.0
    )
    val distCoeffs = MatOfDouble(0.0, 0.0, 0.0, 0.0)
    val rvec = Mat()
    val tvec = Mat()

    val ok = Calib3d.solvePnP(
      modelPoints,
      imagePoints,
      cameraMatrix,
      distCoeffs,
      rvec,
      tvec,
      false,
      Calib3d.SOLVEPNP_ITERATIVE
    )
    if (!ok) return Pose(0.0, 0.0, 0.0)

    val rotMat = Mat()
    Calib3d.Rodrigues(rvec, rotMat)

    val r00 = rotMat.get(0, 0)[0]
    val r01 = rotMat.get(0, 1)[0]
    val r02 = rotMat.get(0, 2)[0]
    val r10 = rotMat.get(1, 0)[0]
    val r11 = rotMat.get(1, 1)[0]
    val r12 = rotMat.get(1, 2)[0]
    val r20 = rotMat.get(2, 0)[0]
    val r21 = rotMat.get(2, 1)[0]
    val r22 = rotMat.get(2, 2)[0]

    val yaw = Math.toDegrees(atan2(r21, r22))
    val pitch = Math.toDegrees(atan2(-r20, sqrt(r21 * r21 + r22 * r22)))
    val roll = Math.toDegrees(atan2(r10, r00))
    return Pose(yaw, pitch, roll)
  }

  private fun averagePoint(points: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>, indices: IntArray): Point {
    var x = 0.0
    var y = 0.0
    for (i in indices) {
      x += points[i].x()
      y += points[i].y()
    }
    val n = indices.size.toDouble()
    return Point(x / n, y / n)
  }

  private fun dist(a: com.google.mediapipe.tasks.components.containers.NormalizedLandmark, b: com.google.mediapipe.tasks.components.containers.NormalizedLandmark): Double {
    val dx = a.x() - b.x()
    val dy = a.y() - b.y()
    return sqrt(dx * dx + dy * dy)
  }

  private fun eyeAspectRatio(points: List<com.google.mediapipe.tasks.components.containers.NormalizedLandmark>, idx: IntArray): Double {
    val p1 = points[idx[0]]
    val p2 = points[idx[1]]
    val p3 = points[idx[2]]
    val p4 = points[idx[3]]
    val p5 = points[idx[4]]
    val p6 = points[idx[5]]
    val v1 = dist(p2, p6)
    val v2 = dist(p3, p5)
    val h = dist(p1, p4)
    return if (h > 0) (v1 + v2) / (2 * h) else 0.0
  }

  private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap? {
    val image = imageProxy.image ?: return null
    val rotation = imageProxy.imageInfo.rotationDegrees
    val nv21 = yuv420ToNv21(image)
    val yuvImage = YuvImage(nv21, ImageFormat.NV21, imageProxy.width, imageProxy.height, null)
    val out = ByteArrayOutputStream()
    yuvImage.compressToJpeg(Rect(0, 0, imageProxy.width, imageProxy.height), 85, out)
    val bytes = out.toByteArray()
    var bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    if (rotation != 0) {
      val matrix = Matrix()
      matrix.postRotate(rotation.toFloat())
      bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
    }
    // Downscale for performance
    val targetW = 320
    if (bmp.width > targetW) {
      val scale = targetW.toFloat() / bmp.width
      val targetH = (bmp.height * scale).toInt()
      bmp = Bitmap.createScaledBitmap(bmp, targetW, targetH, true)
    }
    return bmp
  }

  private fun yuv420ToNv21(image: Image): ByteArray {
    val yBuffer = image.planes[0].buffer
    val uBuffer = image.planes[1].buffer
    val vBuffer = image.planes[2].buffer
    val ySize = yBuffer.remaining()
    val uSize = uBuffer.remaining()
    val vSize = vBuffer.remaining()
    val nv21 = ByteArray(ySize + uSize + vSize)
    yBuffer.get(nv21, 0, ySize)
    val chromaRowStride = image.planes[1].rowStride
    val chromaPixelStride = image.planes[1].pixelStride
    var offset = ySize
    val width = image.width
    val height = image.height
    val vBufferPos = vBuffer.position()
    val uBufferPos = uBuffer.position()
    for (row in 0 until height / 2) {
      var col = 0
      while (col < width / 2) {
        val vuPos = row * chromaRowStride + col * chromaPixelStride
        nv21[offset++] = vBuffer.get(vBufferPos + vuPos)
        nv21[offset++] = uBuffer.get(uBufferPos + vuPos)
        col++
      }
    }
    return nv21
  }

  private fun loadBaseline() {
    val context = appContext ?: return
    val prefs = getPrefs(context)
    baselineGazeX = prefs.getFloat("baseline_gx", 0f).toDouble()
    baselineGazeY = prefs.getFloat("baseline_gy", 0f).toDouble()
    val ear = prefs.getFloat("baseline_ear", 0.18f).toDouble()
    baselineEar = ear
  }

  private fun saveBaseline(meanX: Double, meanY: Double, earMean: Double, earStd: Double) {
    val context = appContext ?: return
    val prefs = getPrefs(context)
    prefs.edit()
      .putFloat("baseline_gx", meanX.toFloat())
      .putFloat("baseline_gy", meanY.toFloat())
      .putFloat("baseline_ear", max(0.18, earMean - earStd).toFloat())
      .apply()
  }

  private fun getPrefs(context: Context) = try {
    val masterKey = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
    EncryptedSharedPreferences.create(
      context,
      "attention_mediapipe",
      masterKey,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
  } catch (_: Exception) {
    context.getSharedPreferences("attention_mediapipe", Context.MODE_PRIVATE)
  }

  data class Point(val x: Double, val y: Double)
  data class Pose(val yaw: Double, val pitch: Double, val roll: Double)
}

private fun List<Double>.averageOrZero(): Double = if (isEmpty()) 0.0 else sum() / size

private fun List<Double>.stddev(): Double {
  if (size < 2) return 0.0
  val mean = averageOrZero()
  val variance = map { (it - mean).pow(2) }.sum() / size
  return sqrt(variance)
}
