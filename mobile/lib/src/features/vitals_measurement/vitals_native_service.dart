import 'package:flutter/services.dart';

class VitalsNativeService {
  static const _channel = MethodChannel('com.hono.vitals/method');
  static const _eventChannel = EventChannel('com.hono.vitals/stream');

  /**
   * ネイティブ側からのリアルタイム更新を購読する
   */
  Stream<Map<String, dynamic>> get vitalsStream {
    return _eventChannel.receiveBroadcastStream().map((event) {
      return Map<String, dynamic>.from(event as Map);
    });
  }

  /**
   * ネイティブ側（MediaPipe）での計測を開始する
   */
  Future<void> startMeasurement() async {
    try {
      await _channel.invokeMethod('startMeasurement');
    } on PlatformException catch (e) {
      print('Failed to start measurement: ${e.message}');
    }
  }

  /**
   * ネイティブ側での計測を停止し、収集されたROIデータを取得する
   */
  Future<Map<String, dynamic>?> stopMeasurement() async {
    try {
      final result = await _channel.invokeMethod<Map<Object?, Object?>>('stopMeasurement');
      return result?.cast<String, dynamic>();
    } on PlatformException catch (e) {
      print('Failed to stop measurement: ${e.message}');
      return null;
    }
  }

  /**
   * リアルタイムの品質状態（顔が枠内にあるか、暗すぎないか等）を監視するためのストリーム
   * (EventChannelの実装はNative側が整ってから追加)
   */
}
