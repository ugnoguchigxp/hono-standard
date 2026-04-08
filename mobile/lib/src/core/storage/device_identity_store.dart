import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

class DeviceIdentityStore {
  DeviceIdentityStore({SharedPreferences? preferences}) : _preferences = preferences;

  static const _deviceTokenKey = 'hono_health_device_token';

  final SharedPreferences? _preferences;

  Future<SharedPreferences> _prefs() async => _preferences ?? SharedPreferences.getInstance();

  Future<String> readOrCreateDeviceToken() async {
    final prefs = await _prefs();
    final existing = prefs.getString(_deviceTokenKey);
    if (existing != null && existing.isNotEmpty) return existing;

    final token = _generateToken();
    await prefs.setString(_deviceTokenKey, token);
    return token;
  }

  String _generateToken() {
    final now = DateTime.now().microsecondsSinceEpoch;
    final random = Random().nextInt(1 << 32).toRadixString(16).padLeft(8, '0');
    return 'device_${now}_$random';
  }
}
