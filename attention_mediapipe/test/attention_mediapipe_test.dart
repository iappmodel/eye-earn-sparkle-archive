import 'package:flutter_test/flutter_test.dart';
import 'package:attention_mediapipe/attention_mediapipe.dart';
import 'package:attention_mediapipe/attention_mediapipe_platform_interface.dart';
import 'package:attention_mediapipe/attention_mediapipe_method_channel.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

class MockAttentionMediapipePlatform
    with MockPlatformInterfaceMixin
    implements AttentionMediapipePlatform {

  @override
  Future<String?> getPlatformVersion() => Future.value('42');
}

void main() {
  final AttentionMediapipePlatform initialPlatform = AttentionMediapipePlatform.instance;

  test('$MethodChannelAttentionMediapipe is the default instance', () {
    expect(initialPlatform, isInstanceOf<MethodChannelAttentionMediapipe>());
  });

  test('getPlatformVersion', () async {
    AttentionMediapipe attentionMediapipePlugin = AttentionMediapipe();
    MockAttentionMediapipePlatform fakePlatform = MockAttentionMediapipePlatform();
    AttentionMediapipePlatform.instance = fakePlatform;

    expect(await attentionMediapipePlugin.getPlatformVersion(), '42');
  });
}
