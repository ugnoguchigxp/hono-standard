// mock_server.dart — ダミー JSON を返す最小サーバー。
// 起動: dart run tool/mock_server.dart
// Flutter: flutter run --dart-define=USE_MOCK=false --dart-define=API_BASE_URL=http://127.0.0.1:19090
import 'dart:convert';
import 'dart:io';

Future<void> main() async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 19090);
  print('Mock listening on http://127.0.0.1:${server.port}');
  await for (final req in server) {
    if (req.uri.path == '/api/v1/health/summary/daily') {
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
          'date': '2026-04-07',
          'stepsTotal': 6000,
          'activeMinutesTotal': 30,
          'activityCaloriesTotal': 210,
          'mealCount': 2,
          'latestBloodPressure': null,
          'latestBloodGlucose': null,
        }),
      );
    } else if (req.uri.path == '/api/v1/health/alerts') {
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
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
        }),
      );
    } else if (req.uri.path == '/api/v1/health/reports/weekly') {
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
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
        }),
      );
    } else if (req.uri.path == '/api/v1/health/reminders/settings') {
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
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
        }),
      );
    } else if (req.uri.path == '/api/v1/health/sync/settings') {
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
          'id': '00000000-0000-0000-0000-000000000040',
          'isEnabled': true,
          'intervalHours': 6,
          'wifiOnly': false,
          'lastSyncedAt': '2026-04-07T09:00:00.000Z',
          'memo': null,
          'createdAt': '2026-04-07T09:00:00.000Z',
          'updatedAt': '2026-04-07T09:00:00.000Z',
        }),
      );
    } else if (req.uri.path == '/api/v1/notifications/device-token') {
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
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
        }),
      );
    } else if (req.uri.path == '/api/v1/health/export') {
      req.response.headers.contentType = ContentType.json;
      req.response.write(
        jsonEncode({
          'exportDate': '2026-04-07',
          'format': req.uri.queryParameters['format'] ?? 'json',
          'period': {'from': '2026-03-08', 'to': '2026-04-07'},
          'records': {
            'bloodPressure': [],
            'bloodGlucose': [],
            'meals': [],
            'activities': [],
            'goals': [],
            'alerts': [],
            'reports': [],
            'reminders': [],
          },
        }),
      );
    } else {
      req.response.statusCode = 404;
      req.response.write('not found');
    }
    await req.response.close();
  }
}
