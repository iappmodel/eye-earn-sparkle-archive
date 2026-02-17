import Flutter
import UIKit
import AVFoundation
import MediaPipeTasksVision
import CoreGraphics
import Foundation
import UIKit

public class AttentionMediapipePlugin: NSObject, FlutterPlugin, FlutterStreamHandler, AVCaptureVideoDataOutputSampleBufferDelegate {
  private var methodChannel: FlutterMethodChannel?
  private var eventChannel: FlutterEventChannel?
  private var eventSink: FlutterEventSink?

  private let session = AVCaptureSession()
  private let sessionQueue = DispatchQueue(label: "attention_mediapipe.session")
  private let outputQueue = DispatchQueue(label: "attention_mediapipe.output")

  private var landmarker: FaceLandmarker?
  private var running = false
  private var fps: Int = 10
  private var lastFrameMs: Int64 = 0
  private var inferenceBusy = false
  private var lastFrameWidth: Double = 0
  private var lastFrameHeight: Double = 0

  private var ema: Double = 0.0
  private let emaAlpha = 0.2
  private var emaWindow: [(Int64, Double)] = []

  private var baselineGazeX: Double = 0.0
  private var baselineGazeY: Double = 0.0
  private var baselineEar: Double = 0.18
  private var isCalibrating = false
  private var calibrationStartMs: Int64 = 0
  private var calibrationGazeX: [Double] = []
  private var calibrationGazeY: [Double] = []
  private var calibrationEar: [Double] = []
  private var gazeNoiseWindow: [(Int64, (Double, Double))] = []

  public static func register(with registrar: FlutterPluginRegistrar) {
    let instance = AttentionMediapipePlugin()
    instance.methodChannel = FlutterMethodChannel(name: "attention_mediapipe/methods", binaryMessenger: registrar.messenger())
    instance.eventChannel = FlutterEventChannel(name: "attention_mediapipe/events", binaryMessenger: registrar.messenger())
    registrar.addMethodCallDelegate(instance, channel: instance.methodChannel!)
    instance.eventChannel?.setStreamHandler(instance)
    instance.loadBaseline()
  }

  public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "start":
      let args = call.arguments as? [String: Any]
      fps = min(30, max(5, args?["fps"] as? Int ?? 10))
      running = true
      startSession()
      result(nil)
    case "stop":
      running = false
      stopSession()
      result(nil)
    case "startCalibration":
      startCalibration()
      result(nil)
    case "finishCalibration":
      result(finishCalibration())
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  public func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    eventSink = events
    return nil
  }

  public func onCancel(withArguments arguments: Any?) -> FlutterError? {
    eventSink = nil
    return nil
  }

  private func startSession() {
    sessionQueue.async {
      if self.session.isRunning { return }
      self.session.beginConfiguration()
      self.session.sessionPreset = .vga640x480

      guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
            let input = try? AVCaptureDeviceInput(device: device) else {
        self.session.commitConfiguration()
        return
      }
      if self.session.canAddInput(input) { self.session.addInput(input) }

      let output = AVCaptureVideoDataOutput()
      output.alwaysDiscardsLateVideoFrames = true
      output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
      output.setSampleBufferDelegate(self, queue: self.outputQueue)
      if self.session.canAddOutput(output) { self.session.addOutput(output) }
      self.session.commitConfiguration()
      self.ensureLandmarker()
      self.session.startRunning()
    }
  }

  private func stopSession() {
    sessionQueue.async {
      if self.session.isRunning {
        self.session.stopRunning()
      }
    }
  }

  private func ensureLandmarker() {
    if landmarker != nil { return }
    let options = FaceLandmarkerOptions()
    options.baseOptions = BaseOptions(modelAssetPath: "face_landmarker.task")
    options.runningMode = .liveStream
    options.minFaceDetectionConfidence = 0.6
    options.minFacePresenceConfidence = 0.6
    options.minTrackingConfidence = 0.6
    options.resultCallback = { [weak self] result, _ in
      guard let self else { return }
      self.inferenceBusy = false
      if let res = result as? FaceLandmarkerResult {
        self.processResult(res)
      }
    }
    landmarker = try? FaceLandmarker(options: options)
  }

  public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
    let now = Int64(Date().timeIntervalSince1970 * 1000)
    if now - lastFrameMs < Int64(1000 / fps) { return }
    if inferenceBusy { return }
    lastFrameMs = now
    inferenceBusy = true
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
      inferenceBusy = false
      return
    }
    lastFrameWidth = Double(CVPixelBufferGetWidth(pixelBuffer))
    lastFrameHeight = Double(CVPixelBufferGetHeight(pixelBuffer))
    let mpImage = MPImage(pixelBuffer: pixelBuffer)
    landmarker?.detectAsync(image: mpImage, timestampInMilliseconds: now)
  }

  private func startCalibration() {
    isCalibrating = true
    calibrationStartMs = Int64(Date().timeIntervalSince1970 * 1000)
    calibrationGazeX.removeAll()
    calibrationGazeY.removeAll()
    calibrationEar.removeAll()
  }

  private func finishCalibration() -> [String: Any] {
    isCalibrating = false
    let meanX = calibrationGazeX.averageOrZero()
    let meanY = calibrationGazeY.averageOrZero()
    let stdX = calibrationGazeX.stddev()
    let stdY = calibrationGazeY.stddev()
    let earMean = calibrationEar.averageOrZero()
    let earStd = calibrationEar.stddev()
    baselineGazeX = meanX
    baselineGazeY = meanY
    if earMean > 0 { baselineEar = max(0.18, earMean - earStd) }
    saveBaseline(meanX: meanX, meanY: meanY, ear: baselineEar)
    return [
      "meanX": meanX,
      "meanY": meanY,
      "stdX": stdX,
      "stdY": stdY,
      "earMean": earMean,
      "earStd": earStd,
      "tsMs": Int64(Date().timeIntervalSince1970 * 1000)
    ]
  }

  private func processResult(_ result: FaceLandmarkerResult) {
    let ts = Int64(Date().timeIntervalSince1970 * 1000)
    guard let face = result.faceLandmarks.first else {
      emitSample(ts: ts, facePresent: false, eyesOpen: false, yaw: 0, pitch: 0, roll: 0, gazeX: 0, gazeY: 0, gazeConf: 0)
      return
    }

    let leftIris = averagePoint(face, [468, 469, 470, 471, 472])
    let rightIris = averagePoint(face, [473, 474, 475, 476, 477])
    let leftEyeCenter = averagePoint(face, [33, 133, 159, 145])
    let rightEyeCenter = averagePoint(face, [362, 263, 386, 374])
    let leftWidth = dist(face[33], face[133])
    let rightWidth = dist(face[362], face[263])
    let leftHeight = dist(face[159], face[145])
    let rightHeight = dist(face[386], face[374])

    var gazeX = ((leftIris.x - leftEyeCenter.x) / max(1e-5, leftWidth) + (rightIris.x - rightEyeCenter.x) / max(1e-5, rightWidth)) / 2.0
    var gazeY = ((leftIris.y - leftEyeCenter.y) / max(1e-5, leftHeight) + (rightIris.y - rightEyeCenter.y) / max(1e-5, rightHeight)) / 2.0
    gazeX = min(1.0, max(-1.0, gazeX))
    gazeY = min(1.0, max(-1.0, gazeY))

    let earLeft = eyeAspectRatio(face, [33, 160, 158, 133, 153, 144])
    let earRight = eyeAspectRatio(face, [362, 385, 387, 263, 373, 380])
    let ear = (earLeft + earRight) / 2.0
    let eyesOpen = ear > baselineEar

    let w = max(1.0, lastFrameWidth)
    let h = max(1.0, lastFrameHeight)
    let imagePoints: [NSValue] = [
      NSValue(cgPoint: CGPoint(x: Double(face[1].x) * w, y: Double(face[1].y) * h)),     // nose tip
      NSValue(cgPoint: CGPoint(x: Double(face[152].x) * w, y: Double(face[152].y) * h)), // chin
      NSValue(cgPoint: CGPoint(x: Double(face[33].x) * w, y: Double(face[33].y) * h)),   // left eye outer
      NSValue(cgPoint: CGPoint(x: Double(face[263].x) * w, y: Double(face[263].y) * h)), // right eye outer
      NSValue(cgPoint: CGPoint(x: Double(face[61].x) * w, y: Double(face[61].y) * h)),   // left mouth
      NSValue(cgPoint: CGPoint(x: Double(face[291].x) * w, y: Double(face[291].y) * h))  // right mouth
    ]
    let pose = AMPHeadPoseEstimator.estimatePose(withImagePoints: imagePoints, imgWidth: w, imgHeight: h)
    let yaw = pose["yaw"] as? Double ?? 0.0
    let pitch = pose["pitch"] as? Double ?? 0.0
    let roll = pose["roll"] as? Double ?? 0.0

    if isCalibrating {
      let elapsed = ts - calibrationStartMs
      if elapsed <= 2000 {
        calibrationGazeX.append(gazeX)
        calibrationGazeY.append(gazeY)
        calibrationEar.append(ear)
      }
    }

    gazeX = min(1.0, max(-1.0, gazeX - baselineGazeX))
    gazeY = min(1.0, max(-1.0, gazeY - baselineGazeY))

    let gazeConf = computeGazeConfidence(ts: ts, gx: gazeX, gy: gazeY)
    emitSample(ts: ts, facePresent: true, eyesOpen: eyesOpen, yaw: yaw, pitch: pitch, roll: roll, gazeX: gazeX, gazeY: gazeY, gazeConf: gazeConf)
  }

  private func emitSample(ts: Int64, facePresent: Bool, eyesOpen: Bool, yaw: Double, pitch: Double, roll: Double, gazeX: Double, gazeY: Double, gazeConf: Double) {
    let headPoseOk = abs(yaw) < 20 && abs(pitch) < 15
    let gazeForward = abs(gazeX) < 0.22 && abs(gazeY) < 0.22
    let base = (facePresent ? 1.0 : 0.0) * 0.35 +
      (eyesOpen ? 1.0 : 0.0) * 0.20 +
      (gazeForward ? 1.0 : 0.0) * 0.30 +
      (headPoseOk ? 1.0 : 0.0) * 0.15
    ema = emaAlpha * base + (1 - emaAlpha) * ema
    emaWindow.append((ts, ema))
    while let first = emaWindow.first, ts - first.0 > 2000 {
      emaWindow.removeFirst()
    }
    let avg = emaWindow.map { $0.1 }.averageOrZero()
    let attentionOk = avg >= 0.70
    var flags: [String] = []
    if !facePresent { flags.append("NO_FACE") }
    if facePresent && !eyesOpen { flags.append("EYES_CLOSED") }
    if facePresent && !gazeForward { flags.append("LOOK_AWAY") }
    if facePresent && !headPoseOk { flags.append("BAD_POSE") }

    let payload: [String: Any] = [
      "tsMs": ts,
      "facePresent": facePresent,
      "eyesOpen": eyesOpen,
      "yawDeg": yaw,
      "pitchDeg": pitch,
      "rollDeg": roll,
      "gazeX": gazeX,
      "gazeY": gazeY,
      "gazeConfidence": gazeConf,
      "attentionConfidence": avg,
      "attentionOk": attentionOk,
      "flags": flags
    ]
    eventSink?(payload)
  }

  private func computeGazeConfidence(ts: Int64, gx: Double, gy: Double) -> Double {
    gazeNoiseWindow.append((ts, (gx, gy)))
    while let first = gazeNoiseWindow.first, ts - first.0 > 2000 {
      gazeNoiseWindow.removeFirst()
    }
    if gazeNoiseWindow.count < 3 { return 0.6 }
    let xs = gazeNoiseWindow.map { $0.1.0 }
    let ys = gazeNoiseWindow.map { $0.1.1 }
    let std = sqrt(xs.stddev() * xs.stddev() + ys.stddev() * ys.stddev())
    return max(0.0, min(1.0, 1.0 - std * 3.0))
  }

  private func averagePoint(_ points: [NormalizedLandmark], _ idx: [Int]) -> (x: Double, y: Double) {
    var x = 0.0
    var y = 0.0
    for i in idx {
      x += Double(points[i].x)
      y += Double(points[i].y)
    }
    let n = Double(idx.count)
    return (x / n, y / n)
  }

  private func dist(_ a: NormalizedLandmark, _ b: NormalizedLandmark) -> Double {
    let dx = Double(a.x - b.x)
    let dy = Double(a.y - b.y)
    return sqrt(dx * dx + dy * dy)
  }

  private func eyeAspectRatio(_ points: [NormalizedLandmark], _ idx: [Int]) -> Double {
    let p1 = points[idx[0]]
    let p2 = points[idx[1]]
    let p3 = points[idx[2]]
    let p4 = points[idx[3]]
    let p5 = points[idx[4]]
    let p6 = points[idx[5]]
    let v1 = dist(p2, p6)
    let v2 = dist(p3, p5)
    let h = dist(p1, p4)
    return h > 0 ? (v1 + v2) / (2 * h) : 0.0
  }

  private func saveBaseline(meanX: Double, meanY: Double, ear: Double) {
    let key = "attention_mediapipe.baseline"
    let dict: [String: Double] = ["gx": meanX, "gy": meanY, "ear": ear]
    let data = try? JSONSerialization.data(withJSONObject: dict, options: [])
    KeychainHelper.save(key: key, data: data ?? Data())
  }

  private func loadBaseline() {
    let key = "attention_mediapipe.baseline"
    if let data = KeychainHelper.load(key: key),
       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Double] {
      baselineGazeX = json["gx"] ?? 0.0
      baselineGazeY = json["gy"] ?? 0.0
      baselineEar = json["ear"] ?? 0.18
    }
  }
}

private extension Array where Element == Double {
  func averageOrZero() -> Double { isEmpty ? 0.0 : reduce(0, +) / Double(count) }
  func stddev() -> Double {
    if count < 2 { return 0.0 }
    let mean = averageOrZero()
    let variance = map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(count)
    return sqrt(variance)
  }
}

private class KeychainHelper {
  static func save(key: String, data: Data) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key
    ]
    SecItemDelete(query as CFDictionary)
    let attributes: [String: Any] = query.merging([kSecValueData as String: data]) { $1 }
    SecItemAdd(attributes as CFDictionary, nil)
  }

  static func load(key: String) -> Data? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne
    ]
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecSuccess {
      return result as? Data
    }
    return nil
  }
}
