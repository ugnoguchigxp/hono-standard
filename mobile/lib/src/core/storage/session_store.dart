import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../session/auth_session.dart';

class SessionStore {
  SessionStore({SharedPreferences? preferences}) : _preferences = preferences;

  static const _sessionKey = 'hono_health_session';

  final SharedPreferences? _preferences;

  Future<SharedPreferences> _prefs() async =>
      _preferences ?? SharedPreferences.getInstance();

  Future<AuthSession?> read() async {
    final prefs = await _prefs();
    final raw = prefs.getString(_sessionKey);
    if (raw == null || raw.isEmpty) return null;

    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return AuthSession.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  Future<void> save(AuthSession session) async {
    final prefs = await _prefs();
    await prefs.setString(_sessionKey, jsonEncode(session.toJson()));
  }

  Future<void> clear() async {
    final prefs = await _prefs();
    await prefs.remove(_sessionKey);
  }
}
