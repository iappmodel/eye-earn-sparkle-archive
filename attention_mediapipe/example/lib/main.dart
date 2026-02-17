import 'dart:async';
import 'package:flutter/material.dart';
import 'package:attention_mediapipe/attention_mediapipe.dart';
import 'package:permission_handler/permission_handler.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final attention = AttentionMediapipe();
  AttentionSample? latest;
  StreamSubscription? sub;
  bool tracking = false;
  bool calibrating = false;
  Map<String, dynamic>? baseline;
  bool rewardEligible = false;
  bool permissionsGranted = false;

  @override
  void dispose() {
    sub?.cancel();
    super.dispose();
  }

  Future<void> startTracking() async {
    await attention.start(fps: 10, useFrontCamera: true, debug: true);
    sub?.cancel();
    sub = attention.samples.listen((sample) {
      setState(() {
        latest = sample;
      });
    });
    setState(() {
      tracking = true;
      rewardEligible = false;
    });
  }

  Future<void> stopTracking() async {
    await attention.stop();
    await sub?.cancel();
    setState(() {
      tracking = false;
    });
  }

  Future<void> startCalibration() async {
    setState(() => calibrating = true);
    await attention.startCalibration();
    await Future.delayed(const Duration(seconds: 2));
    final result = await attention.finishCalibration();
    setState(() {
      baseline = result;
      calibrating = false;
    });
  }

  void simulateReward() {
    if (latest?.attentionOk == true) {
      setState(() => rewardEligible = true);
    }
  }

  Future<void> requestAllPermissions() async {
    final permissions = [
      Permission.camera,
      Permission.microphone,
      Permission.locationWhenInUse,
      Permission.contacts,
    ];
    for (final p in permissions) {
      await p.request();
    }
    final granted = await permissions.everyAsync((p) async => await p.isGranted);
    setState(() => permissionsGranted = granted);
  }

  Future<void> openPermissionSettings() async {
    await openAppSettings();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark(),
      home: Scaffold(
        body: Stack(
          children: [
            if (!permissionsGranted)
              _SignUpPermissionsGate(
                onAllowAll: requestAllPermissions,
                onChoose: openPermissionSettings,
              )
            else
            Container(
              color: const Color(0xFF0A0A0F),
              child: Center(
                child: Container(
                  height: 280,
                  width: double.infinity,
                  margin: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF15151D),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: const Center(
                    child: Text('Promo Video Placeholder', style: TextStyle(color: Colors.white70)),
                  ),
                ),
              ),
            ),
            Positioned(
              top: 40,
              left: 0,
              right: 0,
              child: Column(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.greenAccent, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.greenAccent.withOpacity(0.6),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    tracking ? 'Tracking active' : 'Tracking stopped',
                    style: const TextStyle(fontSize: 12, color: Colors.white70),
                  ),
                ],
              ),
            ),
            Positioned(
              bottom: 24,
              left: 16,
              right: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: tracking ? null : startTracking,
                          child: const Text('Start'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: tracking ? stopTracking : null,
                          child: const Text('Stop'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: calibrating ? null : startCalibration,
                    child: Text(calibrating ? 'Calibrating…' : 'Calibrate (2s)'),
                  ),
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: simulateReward,
                    child: const Text('Finish Video (simulate reward)'),
                  ),
                  const SizedBox(height: 8),
                  if (rewardEligible)
                    const Text(
                      'Reward Eligible ✅',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold),
                    ),
                ],
              ),
            ),
            Positioned(
              right: 12,
              top: 120,
              child: Container(
                width: 160,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black54,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.white12),
                ),
                child: DefaultTextStyle(
                  style: const TextStyle(fontSize: 11, color: Colors.white70),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('attentionOk: ${latest?.attentionOk ?? false}'),
                      Text('conf: ${(latest?.attentionConfidence ?? 0).toStringAsFixed(2)}'),
                      Text('gaze: ${latest?.gazeX.toStringAsFixed(2)} / ${latest?.gazeY.toStringAsFixed(2)}'),
                      Text('pose: ${latest?.yawDeg.toStringAsFixed(1)} / ${latest?.pitchDeg.toStringAsFixed(1)} / ${latest?.rollDeg.toStringAsFixed(1)}'),
                      Text('eyesOpen: ${latest?.eyesOpen ?? false}'),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SignUpPermissionsGate extends StatelessWidget {
  const _SignUpPermissionsGate({
    required this.onAllowAll,
    required this.onChoose,
  });

  final VoidCallback onAllowAll;
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0A0A0F),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text(
            'Enable Full Access',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          const Text(
            'iView needs camera, microphone, location, and contacts permissions for a full experience.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: onAllowAll,
            child: const Text('Allow All Permissions'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: onChoose,
            child: const Text('Choose what to allow'),
          ),
          const SizedBox(height: 16),
          const Text(
            'To change later, use your phone Settings.',
            style: TextStyle(fontSize: 12, color: Colors.white54),
          ),
        ],
      ),
    );
  }
}

extension _EveryAsync on List<Permission> {
  Future<bool> everyAsync(Future<bool> Function(Permission p) test) async {
    for (final p in this) {
      if (!await test(p)) return false;
    }
    return true;
  }
}
