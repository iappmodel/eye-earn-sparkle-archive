## attention_mediapipe

Production-ready Flutter plugin for on-device attention verification using MediaPipe Face Mesh + iris.

### Setup

1) Download the MediaPipe Face Landmarker model:
   - Use `face_landmarker.task` with iris landmarks enabled.
2) Replace the placeholder files:
   - `android/src/main/assets/face_landmarker.task`
   - `ios/Resources/face_landmarker.task`
3) OpenCV is used for solvePnP head pose on both platforms (already configured).

### Example app

```bash
cd attention_mediapipe
flutter pub get
cd example
flutter pub get
```

Android:
```bash
flutter run
```

iOS:
```bash
cd ios
pod install
cd ..
flutter run
```

### API

```dart
final attention = AttentionMediapipe();
await attention.start(fps: 10, useFrontCamera: true, debug: false);
await attention.startCalibration();
final baseline = await attention.finishCalibration();
await attention.stop();
```

### Notes
- All processing runs on-device.
- No frames are stored or uploaded.
- Head pose uses a geometric approximation (yaw/pitch/roll) to avoid OpenCV dependency.
# attention_mediapipe

A new Flutter plugin project.

## Getting Started

This project is a starting point for a Flutter
[plug-in package](https://flutter.dev/to/develop-plugins),
a specialized package that includes platform-specific implementation code for
Android and/or iOS.

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

