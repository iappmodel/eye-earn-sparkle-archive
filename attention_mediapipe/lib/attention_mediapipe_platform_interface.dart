import 'package:plugin_platform_interface/plugin_platform_interface.dart';

import 'attention_mediapipe_method_channel.dart';

abstract class AttentionMediapipePlatform extends PlatformInterface {
  /// Constructs a AttentionMediapipePlatform.
  AttentionMediapipePlatform() : super(token: _token);

  static final Object _token = Object();

  static AttentionMediapipePlatform _instance = MethodChannelAttentionMediapipe();

  /// The default instance of [AttentionMediapipePlatform] to use.
  ///
  /// Defaults to [MethodChannelAttentionMediapipe].
  static AttentionMediapipePlatform get instance => _instance;

  /// Platform-specific implementations should set this with their own
  /// platform-specific class that extends [AttentionMediapipePlatform] when
  /// they register themselves.
  static set instance(AttentionMediapipePlatform instance) {
    PlatformInterface.verifyToken(instance, _token);
    _instance = instance;
  }

  Future<String?> getPlatformVersion() {
    throw UnimplementedError('platformVersion() has not been implemented.');
  }
}
