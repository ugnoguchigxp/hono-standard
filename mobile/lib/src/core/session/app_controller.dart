import 'dart:async';

import 'package:flutter/foundation.dart';

import '../api/health_api.dart';
import '../query/app_query.dart';
import '../storage/session_store.dart';
import 'auth_session.dart';

class AppController extends ChangeNotifier {
  AppController({SessionStore? store}) : store = store ?? SessionStore() {
    api = HealthApiClient(this);
  }

  final SessionStore store;
  late final HealthApiClient api;

  AuthSession? _session;
  bool _isLoading = true;
  Future<bool>? _refreshInFlight;

  bool get isLoading => _isLoading;
  bool get isAuthenticated => _session != null;
  AuthSession? get session => _session;
  String? get accessToken => _session?.accessToken;
  String? get refreshToken => _session?.refreshToken;
  String? get email => _session?.email;
  String? get userId => _session?.userId;

  Future<void> initialize() async {
    if (!_isLoading) return;

    _session = await store.read();
    _isLoading = false;
    notifyListeners();

    if (_session != null) {
      try {
        await api.getMe();
      } catch (_) {
        await clearSession();
      }
    }
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    final session = await api.login(email: email, password: password);
    await _setSession(session);
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final session =
        await api.register(name: name, email: email, password: password);
    await _setSession(session);
  }

  Future<void> logout() async {
    final refreshToken = _session?.refreshToken;
    await clearSession();
    if (refreshToken == null || refreshToken.isEmpty) return;
    try {
      await api.logout(refreshToken);
    } catch (_) {
      // Ignore network failures when the local session is already cleared.
    }
  }

  Future<bool> refreshSession() async {
    if (_session == null) return false;
    if (_refreshInFlight != null) return _refreshInFlight!;

    _refreshInFlight = _refreshSessionInternal();
    try {
      return await _refreshInFlight!;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<bool> _refreshSessionInternal() async {
    final currentRefreshToken = _session?.refreshToken;
    if (currentRefreshToken == null || currentRefreshToken.isEmpty) {
      await clearSession();
      return false;
    }

    try {
      final session = await api.refresh(currentRefreshToken);
      await _setSession(session);
      return true;
    } catch (_) {
      await clearSession();
      return false;
    }
  }

  Future<void> _setSession(AuthSession session) async {
    _session = session;
    await store.save(session);
    clearAppQueryCache();
    notifyListeners();
  }

  Future<void> clearSession() async {
    _session = null;
    await store.clear();
    clearAppQueryCache();
    notifyListeners();
  }
}
