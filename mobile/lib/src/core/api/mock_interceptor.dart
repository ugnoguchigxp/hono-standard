import 'package:dio/dio.dart';

/// モックサーバー未起動時のフォールバック用インターセプター。
/// 本番相当の確認は `tool/mock_server.dart` を起動して USE_MOCK=true で行う。
final InterceptorsWrapper mockInterceptor = InterceptorsWrapper(
  onRequest: (options, handler) async {
    if (options.path.contains('/api/v1/health/summary/daily')) {
      return handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {
            'date': '2026-04-07',
            'stepsTotal': 8420,
            'activeMinutesTotal': 45,
            'activityCaloriesTotal': 320,
            'mealCount': 3,
            'latestBloodPressure': {
              'id': '00000000-0000-0000-0000-000000000001',
              'recordedAt': '2026-04-07T08:00:00.000Z',
              'systolic': 118,
              'diastolic': 76,
              'pulse': 68,
              'period': 'morning',
              'externalId': null,
              'valueHash': null,
              'inputSource': 'manual',
              'syncSource': null,
              'memo': null,
              'createdAt': '2026-04-07T08:00:00.000Z',
              'updatedAt': '2026-04-07T08:00:00.000Z',
            },
            'latestBloodGlucose': null,
          },
        ),
      );
    }
    if (options.path.contains('/api/v1/health/alerts')) {
      return handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {
            'records': [
              {
                'id': '00000000-0000-0000-0000-000000000010',
                'alertKey': 'Asia/Tokyo:high_blood_pressure_trend:2026-04-05:2026-04-07:',
                'alertType': 'high_blood_pressure_trend',
                'severity': 'warning',
                'title': '高血圧傾向を検出しました',
                'message': '直近 3 日間の収縮期血圧が 140 以上です。',
                'timeZone': 'Asia/Tokyo',
                'periodStart': '2026-04-05',
                'periodEnd': '2026-04-07',
                'metricName': 'systolic',
                'currentValue': 142,
                'thresholdValue': 140,
                'goalId': null,
                'isRead': false,
                'readAt': null,
                'detectedAt': '2026-04-07T09:00:00.000Z',
                'createdAt': '2026-04-07T09:00:00.000Z',
                'updatedAt': '2026-04-07T09:00:00.000Z',
              },
            ],
          },
        ),
      );
    }
    if (options.path.contains('/api/v1/health/reports/weekly')) {
      return handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {
            'report': {
              'id': '00000000-0000-0000-0000-000000000020',
              'reportKey': 'Asia/Tokyo:2026-04-07',
              'timeZone': 'Asia/Tokyo',
              'weekStart': '2026-04-07',
              'weekEnd': '2026-04-13',
              'generatedAt': '2026-04-07T09:00:00.000Z',
              'stepsTotal': 48210,
              'avgSteps': 6887,
              'activityCaloriesTotal': 2100,
              'mealCount': 19,
              'mealCaloriesTotal': 6820,
              'mealCaloriesAverage': 974.3,
              'avgSystolic': 120.4,
              'avgDiastolic': 77.2,
              'bloodPressureSampleCount': 7,
              'avgFastingGlucose': 96.2,
              'avgPostprandialGlucose': 132.1,
              'bloodGlucoseSampleCount': 10,
              'goalCount': 3,
              'goalAchievementRateAverage': 82,
              'previousWeekStepsTotal': 45100,
              'stepsDelta': 3110,
              'summary': '歩数 48,210、食事 19 件、目標 3 件',
              'createdAt': '2026-04-07T09:00:00.000Z',
              'updatedAt': '2026-04-07T09:00:00.000Z',
            },
            'generated': true,
          },
        ),
      );
    }
    if (options.path.contains('/api/v1/health/reminders/settings')) {
      return handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {
            'records': [
              {
                'id': '00000000-0000-0000-0000-000000000030',
                'reminderType': 'blood_pressure',
                'isEnabled': true,
                'localTime': '08:00',
                'daysOfWeek': ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                'timeZone': 'Asia/Tokyo',
                'memo': null,
                'createdAt': '2026-04-07T09:00:00.000Z',
                'updatedAt': '2026-04-07T09:00:00.000Z',
              },
            ],
          },
        ),
      );
    }
    if (options.path.contains('/api/v1/health/sync/settings')) {
      return handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {
            'id': '00000000-0000-0000-0000-000000000040',
            'isEnabled': true,
            'intervalHours': 6,
            'wifiOnly': false,
            'lastSyncedAt': '2026-04-07T09:00:00.000Z',
            'memo': null,
            'createdAt': '2026-04-07T09:00:00.000Z',
            'updatedAt': '2026-04-07T09:00:00.000Z',
          },
        ),
      );
    }
    if (options.path.contains('/api/v1/notifications/device-token')) {
      return handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {
            'records': [
              {
                'id': '00000000-0000-0000-0000-000000000050',
                'platform': 'android',
                'deviceToken': 'mock-token',
                'pushEnabled': true,
                'lastSeenAt': '2026-04-07T09:00:00.000Z',
                'createdAt': '2026-04-07T09:00:00.000Z',
                'updatedAt': '2026-04-07T09:00:00.000Z',
              },
            ],
          },
        ),
      );
    }
    if (options.path.contains('/api/v1/health/export')) {
      return handler.resolve(
        Response(
          requestOptions: options,
          statusCode: 200,
          data: {
            'exportDate': '2026-04-07',
            'format': options.queryParameters['format'] ?? 'json',
            'period': {'from': '2026-03-08', 'to': '2026-04-07'},
            'records': {
              'bloodPressure': const [],
              'bloodGlucose': const [],
              'meals': const [],
              'activities': const [],
              'goals': const [],
              'alerts': const [],
              'reports': const [],
              'reminders': const [],
            },
          },
        ),
      );
    }
    return handler.next(options);
  },
);
