import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'attention_mediapipe_platform_interface.dart';

/// An implementation of [AttentionMediapipePlatform] that uses method channels.
class MethodChannelAttentionMediapipe extends AttentionMediapipePlatform {
  /// The method channel used to interact with the native platform.
  @visibleForTesting
  final methodChannel = const MethodChannel('attention_mediapipe');

  @override
  Future<String?> getPlatformVersion() async {
    final version = await methodChannel.invokeMethod<String>('getPlatformVersion');
    return version;
  }
}
