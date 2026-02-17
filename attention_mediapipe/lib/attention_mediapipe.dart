
import 'dart:async';

import 'package:flutter/services.dart';

class AttentionSample {
  AttentionSample({
    required this.tsMs,
    required this.facePresent,
    required this.eyesOpen,
    required this.yawDeg,
    required this.pitchDeg,
    required this.rollDeg,
    required this.gazeX,
    required this.gazeY,
    required this.gazeConfidence,
    required this.attentionConfidence,
    required this.attentionOk,
    required this.flags,
  });

  final int tsMs;
  final bool facePresent;
  final bool eyesOpen;
  final double yawDeg;
  final double pitchDeg;
  final double rollDeg;
  final double gazeX;
  final double gazeY;
  final double gazeConfidence;
  final double attentionConfidence;
  final bool attentionOk;
  final List<String> flags;

  factory AttentionSample.fromMap(Map<dynamic, dynamic> map) {
    return AttentionSample(
      tsMs: (map['tsMs'] as num).toInt(),
      facePresent: map['facePresent'] as bool,
      eyesOpen: map['eyesOpen'] as bool,
      yawDeg: (map['yawDeg'] as num).toDouble(),
      pitchDeg: (map['pitchDeg'] as num).toDouble(),
      rollDeg: (map['rollDeg'] as num).toDouble(),
      gazeX: (map['gazeX'] as num).toDouble(),
      gazeY: (map['gazeY'] as num).toDouble(),
      gazeConfidence: (map['gazeConfidence'] as num).toDouble(),
      attentionConfidence: (map['attentionConfidence'] as num).toDouble(),
      attentionOk: map['attentionOk'] as bool,
      flags: (map['flags'] as List<dynamic>).map((e) => e.toString()).toList(),
    );
  }
}

class AttentionMediapipe {
  static const MethodChannel _channel = MethodChannel('attention_mediapipe/methods');
  static const EventChannel _eventChannel = EventChannel('attention_mediapipe/events');

  Stream<AttentionSample>? _samples;

  Future<void> start({int fps = 10, bool useFrontCamera = true, bool debug = false}) async {
    await _channel.invokeMethod<void>('start', {
      'fps': fps,
      'useFrontCamera': useFrontCamera,
      'debug': debug,
    });
  }

  Future<void> stop() async {
    await _channel.invokeMethod<void>('stop');
  }

  Future<void> startCalibration() async {
    await _channel.invokeMethod<void>('startCalibration');
  }

  Future<Map<String, dynamic>> finishCalibration() async {
    final result = await _channel.invokeMethod<Map<dynamic, dynamic>>('finishCalibration');
    return result?.map((key, value) => MapEntry(key.toString(), value)) ?? {};
  }

  Stream<AttentionSample> get samples {
    _samples ??= _eventChannel.receiveBroadcastStream().map((event) {
      return AttentionSample.fromMap(event as Map<dynamic, dynamic>);
    });
    return _samples!;
  }
}
