import 'package:dio/dio.dart';

import '../constants.dart';
import '../session/app_controller.dart';
import '../session/auth_session.dart';
import 'dio_client.dart';

class HealthApiClient {
  HealthApiClient(this._app) : _dio = buildDio();

  final AppController _app;
  final Dio _dio;

  Map<String, String> _authHeaders() {
    final token = _app.accessToken;
    if (token == null || token.isEmpty) return const {};
    return {'Authorization': 'Bearer $token'};
  }

  Map<String, String> _cookieHeaders(String refreshToken) {
    return {'Cookie': 'refresh_token=$refreshToken'};
  }

  Future<Response<T>> _request<T>(
    Future<Response<T>> Function() action, {
    required bool authorized,
  }) async {
    try {
      return await action();
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      if (authorized && status == 401 && await _app.refreshSession()) {
        return await action();
      }
      rethrow;
    }
  }

  Map<String, dynamic> _map(Map<String, dynamic>? data) => data ?? <String, dynamic>{};

  List<Map<String, dynamic>> _records(Map<String, dynamic>? data, String key) {
    final list = (data?[key] as List<dynamic>? ?? const []);
    return list
        .whereType<Map<String, dynamic>>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/auth/login',
      data: {'email': email, 'password': password},
    );
    return AuthSession.fromJson(_map(res.data));
  }

  Future<AuthSession> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/auth/register',
      data: {'name': name, 'email': email, 'password': password},
    );
    return AuthSession.fromJson(_map(res.data));
  }

  Future<AuthSession> refresh(String refreshToken) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/api/auth/refresh',
      options: Options(headers: _cookieHeaders(refreshToken)),
    );
    return AuthSession.fromJson(_map(res.data));
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post<void>(
      '/api/auth/logout',
      options: Options(headers: _cookieHeaders(refreshToken)),
    );
  }

  Future<Map<String, dynamic>> getAuthMethods() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/auth/methods');
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/auth/me',
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getDailySummary({String? date}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/summary/daily',
        queryParameters: {
          if (date != null) 'date': date,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getWeeklyReport({String? weekStart}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/reports/weekly',
        queryParameters: {
          if (weekStart != null) 'weekStart': weekStart,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getAlerts({bool? isRead, int? limit = 5}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/alerts',
        queryParameters: {
          if (isRead != null) 'isRead': isRead,
          if (limit != null) 'limit': limit,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getReminderSettings() async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/reminders/settings',
        queryParameters: const {'timeZone': kAppTimeZone},
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateReminderSetting(
    String reminderType,
    Map<String, dynamic> body,
  ) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(
        '/api/v1/health/reminders/settings/$reminderType',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getSyncPreference() async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/sync/settings',
        queryParameters: const {'timeZone': kAppTimeZone},
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateSyncPreference(Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(
        '/api/v1/health/sync/settings',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> registerNotificationDevice(Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        '/api/v1/notifications/device-token',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> listNotificationDevices() async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/notifications/device-token',
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> exportHealthData({
    String format = 'json',
    String? from,
    String? to,
  }) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/export',
        queryParameters: {
          'format': format,
          if (from != null) 'from': from,
          if (to != null) 'to': to,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getHealthGoals() async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/goals',
        queryParameters: const {'timeZone': kAppTimeZone},
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> createHealthGoal(Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        '/api/v1/health/goals',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateHealthGoal(String id, Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(
        '/api/v1/health/goals/$id',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<void> deleteHealthGoal(String id) async {
    await _request<void>(
      () => _dio.delete<void>(
        '/api/v1/health/goals/$id',
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
  }

  Future<Map<String, dynamic>> getGoalAchievements({String? date}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/goals/achievements',
        queryParameters: {
          if (date != null) 'date': date,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> createBloodPressure(Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        '/api/v1/health/vitals/blood-pressure',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateBloodPressure(String id, Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(
        '/api/v1/health/vitals/blood-pressure/$id',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<void> deleteBloodPressure(String id) async {
    await _request<void>(
      () => _dio.delete<void>(
        '/api/v1/health/vitals/blood-pressure/$id',
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
  }

  Future<Map<String, dynamic>> listBloodPressure({String? from, String? to}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/vitals/blood-pressure',
        queryParameters: {
          if (from != null) 'from': from,
          if (to != null) 'to': to,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> createBloodGlucose(Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        '/api/v1/health/vitals/blood-glucose',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateBloodGlucose(String id, Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(
        '/api/v1/health/vitals/blood-glucose/$id',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<void> deleteBloodGlucose(String id) async {
    await _request<void>(
      () => _dio.delete<void>(
        '/api/v1/health/vitals/blood-glucose/$id',
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
  }

  Future<Map<String, dynamic>> listBloodGlucose({String? from, String? to}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/vitals/blood-glucose',
        queryParameters: {
          if (from != null) 'from': from,
          if (to != null) 'to': to,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> createMeal(Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        '/api/v1/health/nutrition/meals',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> createActivity(Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        '/api/v1/health/activity/records',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateMeal(String id, Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(
        '/api/v1/health/nutrition/meals/$id',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateActivity(String id, Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(
        '/api/v1/health/activity/records/$id',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<void> deleteMeal(String id) async {
    await _request<void>(
      () => _dio.delete<void>(
        '/api/v1/health/nutrition/meals/$id',
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
  }

  Future<void> deleteActivity(String id) async {
    await _request<void>(
      () => _dio.delete<void>(
        '/api/v1/health/activity/records/$id',
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
  }

  Future<Map<String, dynamic>> listMeals({String? from, String? to}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/nutrition/meals',
        queryParameters: {
          if (from != null) 'from': from,
          if (to != null) 'to': to,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> createWeight(Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.post<Map<String, dynamic>>(
        '/api/v1/health/vitals/weight',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> updateWeight(String id, Map<String, dynamic> body) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.put<Map<String, dynamic>>(
        '/api/v1/health/vitals/weight/$id',
        data: body,
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<void> deleteWeight(String id) async {
    await _request<void>(
      () => _dio.delete<void>(
        '/api/v1/health/vitals/weight/$id',
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
  }

  Future<Map<String, dynamic>> listWeight({String? from, String? to}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/vitals/weight',
        queryParameters: {
          if (from != null) 'from': from,
          if (to != null) 'to': to,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getActivityRecords({String? from, String? to}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/activity/records',
        queryParameters: {
          if (from != null) 'from': from,
          if (to != null) 'to': to,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  Future<Map<String, dynamic>> getDailyActivity({String? date}) async {
    final res = await _request<Map<String, dynamic>>(
      () => _dio.get<Map<String, dynamic>>(
        '/api/v1/health/activity/daily',
        queryParameters: {
          if (date != null) 'date': date,
          'timeZone': kAppTimeZone,
        },
        options: Options(headers: _authHeaders()),
      ),
      authorized: true,
    );
    return _map(res.data);
  }

  List<Map<String, dynamic>> listRecords(Map<String, dynamic> response, String key) {
    return _records(response, key);
  }
}
