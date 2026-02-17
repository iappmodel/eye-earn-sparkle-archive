import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:attention_mediapipe/attention_mediapipe_method_channel.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  MethodChannelAttentionMediapipe platform = MethodChannelAttentionMediapipe();
  const MethodChannel channel = MethodChannel('attention_mediapipe');

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      channel,
      (MethodCall methodCall) async {
        return '42';
      },
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, null);
  });

  test('getPlatformVersion', () async {
    expect(await platform.getPlatformVersion(), '42');
  });
}
