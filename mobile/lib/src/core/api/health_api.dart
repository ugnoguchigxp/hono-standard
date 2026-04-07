import 'package:dio/dio.dart';

import 'dio_client.dart';

class HealthApi {
  HealthApi._(this._dio);

  final Dio _dio;

  static HealthApi create() => HealthApi._(buildDio());

  Future<Map<String, dynamic>> getDailySummary({String? date}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/health/summary/daily',
      queryParameters: {if (date != null) 'date': date},
    );
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> getAlerts({bool? isRead, int? limit = 5}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/health/alerts',
      queryParameters: {if (isRead != null) 'isRead': isRead, if (limit != null) 'limit': limit},
    );
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> getWeeklyReport({String? weekStart}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/health/reports/weekly',
      queryParameters: {if (weekStart != null) 'weekStart': weekStart},
    );
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> getReminderSettings() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/v1/health/reminders/settings');
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> updateReminderSetting(
    String reminderType,
    Map<String, dynamic> body,
  ) async {
    final res = await _dio.put<Map<String, dynamic>>(
      '/api/v1/health/reminders/settings/$reminderType',
      data: body,
    );
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> getSyncPreference() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/v1/health/sync/settings');
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> updateSyncPreference(Map<String, dynamic> body) async {
    final res = await _dio.put<Map<String, dynamic>>('/api/v1/health/sync/settings', data: body);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> registerNotificationDevice(Map<String, dynamic> body) async {
    final res = await _dio.post<Map<String, dynamic>>('/api/v1/notifications/device-token', data: body);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> listNotificationDevices() async {
    final res = await _dio.get<Map<String, dynamic>>('/api/v1/notifications/device-token');
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> exportHealthData({
    String format = 'json',
    String? from,
    String? to,
  }) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/api/v1/health/export',
      queryParameters: {
        'format': format,
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      },
    );
    return _asMap(res.data);
  }

  Map<String, dynamic> _asMap(Map<String, dynamic>? data) => data ?? <String, dynamic>{};
}
