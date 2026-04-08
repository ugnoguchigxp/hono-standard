import 'dart:math';

import 'package:dio/dio.dart';

import '../constants.dart';

final InterceptorsWrapper mockInterceptor = InterceptorsWrapper(
  onRequest: (options, handler) async {
    final state = _mockState;
    final path = options.path;
    final method = options.method.toUpperCase();

    Response<dynamic>? response;

    if (path == '/api/auth/methods' && method == 'GET') {
      response = _json(options, {
        'authMode': 'local',
        'local': true,
        'oauth': {
          'enabled': false,
          'providers': {'google': false, 'github': false},
        },
      });
    } else if (path == '/api/auth/login' && method == 'POST') {
      final data = _asMap(options.data);
      response = _json(
          options,
          state.login(
            email: data['email'] as String? ?? 'user@example.com',
            name: 'Demo User',
          ));
    } else if (path == '/api/auth/register' && method == 'POST') {
      final data = _asMap(options.data);
      response = _json(
          options,
          state.login(
            email: data['email'] as String? ?? 'user@example.com',
            name: data['name'] as String? ?? 'Demo User',
          ));
    } else if (path == '/api/auth/refresh' && method == 'POST') {
      final refreshToken = _cookieValue(options, 'refresh_token');
      response = refreshToken == state.refreshToken && state.loggedIn
          ? _json(options, state.rotateTokens())
          : _error(options, 401, 'Missing or invalid refresh token');
    } else if (path == '/api/auth/logout' && method == 'POST') {
      final refreshToken = _cookieValue(options, 'refresh_token');
      if (refreshToken == state.refreshToken) {
        state.logout();
      }
      response = _json(options, {'success': true});
    } else if (path == '/api/auth/me' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(options, {
              'userId': state.userId,
              'email': state.email,
              'name': state.name
            })
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/summary/daily' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(options,
              state.dailySummary(options.queryParameters['date'] as String?))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/alerts' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(options, state.alerts())
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/reports/weekly' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(
              options,
              state.weeklyReport(
                  options.queryParameters['weekStart'] as String?))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/reminders/settings' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(options, {'records': state.reminderRecords()})
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/reminders/settings/') &&
        method == 'PUT') {
      if (_authorized(options, state)) {
        final reminderType = path.split('/').last;
        final body = _asMap(options.data);
        response = _json(options, state.updateReminder(reminderType, body));
      } else {
        response = _error(options, 401, 'Unauthorized');
      }
    } else if (path == '/api/v1/health/sync/settings' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(options, state.syncPreference)
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/sync/settings' && method == 'PUT') {
      if (_authorized(options, state)) {
        response = _json(options, state.updateSync(_asMap(options.data)));
      } else {
        response = _error(options, 401, 'Unauthorized');
      }
    } else if (path == '/api/v1/health/profile' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(options, state.healthProfile())
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/profile' && method == 'PUT') {
      if (_authorized(options, state)) {
        response =
            _json(options, state.updateHealthProfile(_asMap(options.data)));
      } else {
        response = _error(options, 401, 'Unauthorized');
      }
    } else if (path == '/api/v1/notifications/device-token' &&
        method == 'GET') {
      response = _authorized(options, state)
          ? _json(options, {'records': state.devices})
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/notifications/device-token' &&
        method == 'POST') {
      if (_authorized(options, state)) {
        response = _json(options, state.addDevice(_asMap(options.data)));
      } else {
        response = _error(options, 401, 'Unauthorized');
      }
    } else if (path == '/api/v1/health/export' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(
              options,
              state.exportPayload(
                  options.queryParameters['format'] as String? ?? 'json'))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/goals' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(options, {'records': state.goals})
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/goals' && method == 'POST') {
      response = _authorized(options, state)
          ? _json(options, state.createGoal(_asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/goals/') && method == 'PUT') {
      response = _authorized(options, state)
          ? _json(options,
              state.updateGoal(_idFromPath(path), _asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/goals/') && method == 'DELETE') {
      response = _authorized(options, state)
          ? _json(options, state.deleteGoal(_idFromPath(path)))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/goals/achievements' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(
              options,
              state
                  .goalAchievements(options.queryParameters['date'] as String?))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/vitals/blood-pressure' &&
        method == 'GET') {
      response = _authorized(options, state)
          ? _json(options,
              {'records': state.listBloodPressure(options.queryParameters)})
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/vitals/blood-pressure' &&
        method == 'POST') {
      response = _authorized(options, state)
          ? _json(options, state.createBloodPressure(_asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/vitals/blood-pressure/') &&
        method == 'PUT') {
      response = _authorized(options, state)
          ? _json(
              options,
              state.updateBloodPressure(
                  _idFromPath(path), _asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/vitals/blood-pressure/') &&
        method == 'DELETE') {
      response = _authorized(options, state)
          ? _json(options, state.deleteBloodPressure(_idFromPath(path)))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/vitals/blood-glucose' &&
        method == 'GET') {
      response = _authorized(options, state)
          ? _json(options,
              {'records': state.listBloodGlucose(options.queryParameters)})
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/vitals/blood-glucose' &&
        method == 'POST') {
      response = _authorized(options, state)
          ? _json(options, state.createBloodGlucose(_asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/vitals/blood-glucose/') &&
        method == 'PUT') {
      response = _authorized(options, state)
          ? _json(options,
              state.updateBloodGlucose(_idFromPath(path), _asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/vitals/blood-glucose/') &&
        method == 'DELETE') {
      response = _authorized(options, state)
          ? _json(options, state.deleteBloodGlucose(_idFromPath(path)))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/nutrition/meals' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(
              options, {'records': state.listMeals(options.queryParameters)})
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/nutrition/meals' && method == 'POST') {
      response = _authorized(options, state)
          ? _json(options, state.createMeal(_asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/nutrition/meals/') &&
        method == 'PUT') {
      response = _authorized(options, state)
          ? _json(options,
              state.updateMeal(_idFromPath(path), _asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/nutrition/meals/') &&
        method == 'DELETE') {
      response = _authorized(options, state)
          ? _json(options, state.deleteMeal(_idFromPath(path)))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/vitals/weight' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(
              options, {'records': state.listWeight(options.queryParameters)})
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/vitals/weight' && method == 'POST') {
      response = _authorized(options, state)
          ? _json(options, state.createWeight(_asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/vitals/weight/') &&
        method == 'PUT') {
      response = _authorized(options, state)
          ? _json(options,
              state.updateWeight(_idFromPath(path), _asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/vitals/weight/') &&
        method == 'DELETE') {
      response = _authorized(options, state)
          ? _json(options, state.deleteWeight(_idFromPath(path)))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/activity/records' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(
              options, {'records': state.listActivity(options.queryParameters)})
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/activity/records' && method == 'POST') {
      response = _authorized(options, state)
          ? _json(options, state.createActivity(_asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/activity/records/') &&
        method == 'PUT') {
      response = _authorized(options, state)
          ? _json(options,
              state.updateActivity(_idFromPath(path), _asMap(options.data)))
          : _error(options, 401, 'Unauthorized');
    } else if (path.startsWith('/api/v1/health/activity/records/') &&
        method == 'DELETE') {
      response = _authorized(options, state)
          ? _json(options, state.deleteActivity(_idFromPath(path)))
          : _error(options, 401, 'Unauthorized');
    } else if (path == '/api/v1/health/activity/daily' && method == 'GET') {
      response = _authorized(options, state)
          ? _json(options,
              state.dailyActivity(options.queryParameters['date'] as String?))
          : _error(options, 401, 'Unauthorized');
    }

    if (response != null) return handler.resolve(response);
    return handler.next(options);
  },
);

bool _authorized(RequestOptions options, _MockApiState state) {
  final header = options.headers['Authorization'] as String?;
  return state.loggedIn && header == 'Bearer ${state.accessToken}';
}

Response<dynamic> _json(RequestOptions options, Object? data,
    [int statusCode = 200]) {
  return Response(
    requestOptions: options,
    statusCode: statusCode,
    data: data,
  );
}

Response<dynamic> _error(
    RequestOptions options, int statusCode, String message) {
  return Response(
    requestOptions: options,
    statusCode: statusCode,
    data: {
      'error': {'message': message},
    },
  );
}

Map<String, dynamic> _asMap(Object? data) {
  if (data is Map<String, dynamic>) return Map<String, dynamic>.from(data);
  return <String, dynamic>{};
}

String _idFromPath(String path) => path.split('/').last;

String _cookieValue(RequestOptions options, String name) {
  final cookie = options.headers['Cookie'] as String?;
  if (cookie == null) return '';
  for (final chunk in cookie.split(';')) {
    final parts = chunk.trim().split('=');
    if (parts.length == 2 && parts.first == name) return parts.last;
  }
  return '';
}

final _MockApiState _mockState = _MockApiState();

void resetMockApiState() {
  _mockState.reset();
}

class _MockApiState {
  _MockApiState()
      : bloodPressure = [],
        bloodGlucose = [],
        meals = [],
        weights = [],
        activities = [],
        goals = [],
        reminders = {},
        syncPreference = _sync(),
        devices = [],
        accessToken = 'mock-access-1',
        refreshToken = 'mock-refresh-1',
        userId = 'user-1',
        email = 'demo@example.com',
        name = 'Demo User',
        age = 34,
        gender = 'male',
        heightCm = 170,
        activityLevel = 'moderate' {
    reset();
  }

  bool loggedIn = false;
  String accessToken;
  String refreshToken;
  final String userId;
  String email;
  String name;
  int? age;
  String? gender;
  num? heightCm;
  String? activityLevel;
  final List<Map<String, dynamic>> bloodPressure;
  final List<Map<String, dynamic>> bloodGlucose;
  final List<Map<String, dynamic>> meals;
  final List<Map<String, dynamic>> weights;
  final List<Map<String, dynamic>> activities;
  final List<Map<String, dynamic>> goals;
  final Map<String, Map<String, dynamic>> reminders;
  final Map<String, dynamic> syncPreference;
  final List<Map<String, dynamic>> devices;
  int _tokenVersion = 1;
  int _nextId = 100;

  void reset() {
    loggedIn = false;
    accessToken = 'mock-access-1';
    refreshToken = 'mock-refresh-1';
    email = 'demo@example.com';
    name = 'Demo User';
    age = 34;
    gender = 'male';
    heightCm = 170;
    activityLevel = 'moderate';
    _tokenVersion = 1;
    _nextId = 100;

    bloodPressure
      ..clear()
      ..addAll([
        _bp(
          1,
          recordedAt: '2026-04-07T08:00:00.000Z',
          systolic: 118,
          diastolic: 76,
          pulse: 68,
          period: 'morning',
        ),
        _bp(
          2,
          recordedAt: '2026-04-06T20:30:00.000Z',
          systolic: 121,
          diastolic: 79,
          pulse: 70,
          period: 'evening',
        ),
      ]);
    bloodGlucose
      ..clear()
      ..addAll([
        _glucose(
          1,
          recordedAt: '2026-04-07T07:30:00.000Z',
          value: 95,
          unit: 'mg_dl',
          timing: 'fasting',
        ),
      ]);
    meals
      ..clear()
      ..addAll([
        _meal(
          1,
          recordedAt: '2026-04-07T12:20:00.000Z',
          items: '玄米ごはん、味噌汁、焼き魚',
          estimatedCalories: 520,
        ),
      ]);
    weights
      ..clear()
      ..addAll([
        _weight(
          1,
          recordedAt: '2026-04-07T06:40:00.000Z',
          value: 68.4,
        ),
      ]);
    activities
      ..clear()
      ..addAll([
        _activity(
          1,
          recordedAt: '2026-04-07T18:00:00.000Z',
          steps: 8420,
          activeMinutes: 45,
          caloriesBurned: 320,
        ),
      ]);
    goals
      ..clear()
      ..addAll([
        _goal(1,
            goalType: 'daily_step_count',
            targetValue: 8000,
            startsOn: '2026-04-01'),
      ]);
    syncPreference
      ..clear()
      ..addAll(_sync());
    reminders
      ..clear()
      ..addAll({
        'blood_pressure': _reminder('blood_pressure', '08:00'),
        'blood_glucose': _reminder('blood_glucose', '07:30'),
        'meal': _reminder('meal', '12:00'),
        'activity': _reminder('activity', '18:00'),
      });
    devices
      ..clear()
      ..add(_device(1));
  }

  Map<String, dynamic> login({required String email, required String name}) {
    loggedIn = true;
    this.email = email;
    this.name = name;
    return _sessionPayload();
  }

  Map<String, dynamic> rotateTokens() {
    _tokenVersion += 1;
    accessToken = 'mock-access-$_tokenVersion';
    refreshToken = 'mock-refresh-$_tokenVersion';
    return _sessionPayload();
  }

  void logout() {
    loggedIn = false;
  }

  Map<String, dynamic> _sessionPayload() {
    return {
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'user': {'id': userId, 'email': email, 'name': name},
    };
  }

  Map<String, dynamic> dailySummary(String? date) {
    final latestBp = bloodPressure.isEmpty ? null : bloodPressure.first;
    final latestGlucose = bloodGlucose.isEmpty ? null : bloodGlucose.first;
    final day = date ?? '2026-04-07';
    return {
      'date': day,
      'stepsTotal': activities.fold<int>(
          0, (sum, row) => sum + (row['steps'] as int? ?? 0)),
      'activeMinutesTotal': activities.fold<int>(
          0, (sum, row) => sum + (row['activeMinutes'] as int? ?? 0)),
      'activityCaloriesTotal': activities.fold<int>(
          0, (sum, row) => sum + (row['caloriesBurned'] as int? ?? 0)),
      'mealCount': meals.length,
      'latestBloodPressure': latestBp,
      'latestBloodGlucose': latestGlucose,
    };
  }

  Map<String, dynamic> dailyActivity(String? date) {
    return {
      'date': date ?? '2026-04-07',
      'stepsTotal': activities.fold<int>(
          0, (sum, row) => sum + (row['steps'] as int? ?? 0)),
      'activeMinutesTotal': activities.fold<int>(
          0, (sum, row) => sum + (row['activeMinutes'] as int? ?? 0)),
      'caloriesBurnedTotal': activities.fold<int>(
          0, (sum, row) => sum + (row['caloriesBurned'] as int? ?? 0)),
      'records': activities,
    };
  }

  Map<String, dynamic> alerts() {
    return {
      'records': [
        {
          'id': _uuid(200),
          'alertKey': 'mock:high_blood_pressure_trend',
          'alertType': 'high_blood_pressure_trend',
          'severity': 'warning',
          'title': '高血圧傾向を検出しました',
          'message': '直近 3 日間の収縮期血圧が 140 以上です。',
          'timeZone': kAppTimeZone,
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
    };
  }

  Map<String, dynamic> weeklyReport(String? weekStart) {
    final stepsTotal = activities.fold<int>(
        0, (sum, row) => sum + (row['steps'] as int? ?? 0));
    final mealCalories = meals.fold<int>(
        0, (sum, row) => sum + (row['estimatedCalories'] as int? ?? 0));
    return {
      'report': {
        'id': _uuid(300),
        'reportKey': 'mock:${weekStart ?? '2026-04-07'}',
        'timeZone': kAppTimeZone,
        'weekStart': weekStart ?? '2026-04-07',
        'weekEnd': '2026-04-13',
        'generatedAt': '2026-04-07T09:00:00.000Z',
        'stepsTotal': stepsTotal,
        'avgSteps': stepsTotal / 7,
        'activityCaloriesTotal': activities.fold<int>(
            0, (sum, row) => sum + (row['caloriesBurned'] as int? ?? 0)),
        'mealCount': meals.length,
        'mealCaloriesTotal': mealCalories,
        'mealCaloriesAverage':
            meals.isEmpty ? null : mealCalories / meals.length,
        'avgSystolic': average(bloodPressure.map((r) => r['systolic'] as num)),
        'avgDiastolic':
            average(bloodPressure.map((r) => r['diastolic'] as num)),
        'bloodPressureSampleCount': bloodPressure.length,
        'avgFastingGlucose': average(
          bloodGlucose
              .where((r) => r['timing'] == 'fasting')
              .map((r) => r['value'] as num),
        ),
        'avgPostprandialGlucose': average(
          bloodGlucose
              .where((r) => r['timing'] == 'postprandial')
              .map((r) => r['value'] as num),
        ),
        'bloodGlucoseSampleCount': bloodGlucose.length,
        'goalCount': goals.length,
        'goalAchievementRateAverage': 80,
        'previousWeekStepsTotal': stepsTotal - 300,
        'stepsDelta': 300,
        'summary':
            '歩数 ${stepsTotal.toString()}, 食事 ${meals.length} 件, 目標 ${goals.length} 件',
        'createdAt': '2026-04-07T09:00:00.000Z',
        'updatedAt': '2026-04-07T09:00:00.000Z',
      },
      'generated': true,
    };
  }

  List<Map<String, dynamic>> reminderRecords() => reminders.values.toList();

  Map<String, dynamic> updateReminder(
      String reminderType, Map<String, dynamic> body) {
    final current = reminders[reminderType] ?? _reminder(reminderType, '08:00');
    reminders[reminderType] = {
      ...current,
      'isEnabled': body['isEnabled'] ?? current['isEnabled'] ?? false,
      'localTime': body['localTime'] ?? current['localTime'] ?? '08:00',
      'timeZone': body['timeZone'] ?? current['timeZone'] ?? kAppTimeZone,
      'memo': body['memo'] ?? current['memo'],
      'updatedAt': _now(),
    };
    return reminders[reminderType]!;
  }

  Map<String, dynamic> updateSync(Map<String, dynamic> body) {
    syncPreference['isEnabled'] =
        body['isEnabled'] ?? syncPreference['isEnabled'];
    syncPreference['intervalHours'] =
        body['intervalHours'] ?? syncPreference['intervalHours'];
    syncPreference['wifiOnly'] = body['wifiOnly'] ?? syncPreference['wifiOnly'];
    syncPreference['updatedAt'] = _now();
    return syncPreference;
  }

  Map<String, dynamic> healthProfile() {
    final latestWeight =
        weights.isEmpty ? null : weights.first['value'] as num?;
    final bmr = _calculateBmr(
      weightKg: latestWeight?.toDouble(),
      heightCm: heightCm?.toDouble(),
      age: age,
      gender: gender,
    );
    return {
      'userId': userId,
      'email': email,
      'name': name,
      'age': age,
      'gender': gender,
      'heightCm': heightCm,
      'activityLevel': activityLevel,
      'latestWeightKg': latestWeight,
      'bmr': bmr,
      'recommendedDailyCalorieGoal': bmr,
      'updatedAt': _now(),
    };
  }

  Map<String, dynamic> updateHealthProfile(Map<String, dynamic> body) {
    if (body.containsKey('age')) {
      age = (body['age'] as num?)?.toInt();
    }
    if (body.containsKey('gender')) {
      final value = body['gender'] as String?;
      gender = value == 'male' || value == 'female' ? value : null;
    }
    if (body.containsKey('heightCm')) {
      heightCm = body['heightCm'] as num?;
    }
    if (body.containsKey('activityLevel')) {
      final value = body['activityLevel'] as String?;
      const allowed = {
        'sedentary',
        'light',
        'moderate',
        'active',
        'very_active'
      };
      activityLevel = allowed.contains(value) ? value : null;
    }
    return healthProfile();
  }

  Map<String, dynamic> addDevice(Map<String, dynamic> body) {
    final record = {
      'id': _uuid(_next()),
      'platform': body['platform'] ?? 'ios',
      'deviceToken': body['deviceToken'] ?? 'mock-device-token',
      'pushEnabled': body['pushEnabled'] ?? true,
      'lastSeenAt': _now(),
      'createdAt': _now(),
      'updatedAt': _now(),
    };
    devices.add(record);
    return record;
  }

  Map<String, dynamic> exportPayload(String format) {
    return {
      'exportDate': '2026-04-07',
      'format': format,
      'period': {'from': '2026-03-08', 'to': '2026-04-07'},
      'records': {
        'bloodPressure': bloodPressure,
        'bloodGlucose': bloodGlucose,
        'meals': meals,
        'weight': weights,
        'activities': activities,
        'goals': goals,
        'alerts': alerts()['records'],
        'reports': [weeklyReport('2026-04-07')['report']],
        'reminders': reminderRecords(),
      },
    };
  }

  Map<String, dynamic> goalAchievements(String? date) {
    final mealCaloriesTotal = meals.fold<int>(
        0, (sum, row) => sum + (row['estimatedCalories'] as int? ?? 0));
    final latestBp = bloodPressure.isEmpty ? null : bloodPressure.first;
    final fastingGlucose =
        bloodGlucose.where((row) => row['timing'] == 'fasting').toList();
    final postprandialGlucose =
        bloodGlucose.where((row) => row['timing'] == 'postprandial').toList();
    final latestWeight = weights.isEmpty ? null : weights.first;
    final stepTotal = activities.fold<int>(
        0, (sum, row) => sum + (row['steps'] as int? ?? 0));
    final qualifyingExerciseDays = activities
        .map((row) =>
            (row['recordedAt'] as String? ?? '2026-04-07').substring(0, 10))
        .toSet()
        .length;

    num? currentValueForGoal(Map<String, dynamic> goal) {
      switch (goal['goalType']) {
        case 'daily_step_count':
          return stepTotal;
        case 'daily_calorie_limit':
          return mealCaloriesTotal;
        case 'blood_pressure_systolic_max':
          return latestBp?['systolic'] as num?;
        case 'blood_pressure_diastolic_max':
          return latestBp?['diastolic'] as num?;
        case 'blood_glucose_fasting_range':
          return fastingGlucose.isEmpty
              ? null
              : fastingGlucose.first['value'] as num?;
        case 'blood_glucose_postprandial_range':
          return postprandialGlucose.isEmpty
              ? null
              : postprandialGlucose.first['value'] as num?;
        case 'weekly_exercise_days':
          return qualifyingExerciseDays;
        case 'weight_target':
          return latestWeight?['value'] as num?;
        default:
          return null;
      }
    }

    return {
      'asOfDate': date ?? '2026-04-07',
      'items': goals.map(
        (goal) {
          final currentValue = currentValueForGoal(goal);
          final targetValue = goal['targetValue'] as num?;
          final targetMin = goal['targetMin'] as num?;
          final targetMax = goal['targetMax'] as num?;
          bool achieved = false;
          double achievementRate = 0;
          String details = 'mock';

          switch (goal['goalType']) {
            case 'daily_step_count':
            case 'weekly_exercise_days':
              achieved = currentValue != null &&
                  targetValue != null &&
                  currentValue >= targetValue;
              achievementRate =
                  currentValue != null && targetValue != null && targetValue > 0
                      ? ((currentValue / targetValue) * 100)
                          .clamp(0, 100)
                          .toDouble()
                      : 0;
              details = 'current ${currentValue?.toString() ?? '-'}';
              break;
            case 'daily_calorie_limit':
            case 'blood_pressure_systolic_max':
            case 'blood_pressure_diastolic_max':
            case 'weight_target':
              achieved = currentValue != null &&
                  targetValue != null &&
                  currentValue <= targetValue;
              achievementRate = currentValue != null &&
                      targetValue != null &&
                      currentValue > 0
                  ? ((targetValue / currentValue) * 100)
                      .clamp(0, 100)
                      .toDouble()
                  : 0;
              details = 'current ${currentValue?.toString() ?? '-'}';
              break;
            case 'blood_glucose_fasting_range':
            case 'blood_glucose_postprandial_range':
              achieved = currentValue != null &&
                  targetMin != null &&
                  targetMax != null &&
                  currentValue >= targetMin &&
                  currentValue <= targetMax;
              achievementRate = achieved ? 100 : 0;
              details = 'current ${currentValue?.toString() ?? '-'}';
              break;
          }

          return {
            'goal': goal,
            'asOfDate': date ?? '2026-04-07',
            'currentValue': currentValue,
            'targetValue': targetValue,
            'achievementRate': achievementRate,
            'achieved': achieved,
            'details': details,
          };
        },
      ).toList(),
    };
  }

  Map<String, dynamic> createGoal(Map<String, dynamic> body) {
    final record = {
      'id': _uuid(_next()),
      'goalType': body['goalType'] ?? 'daily_step_count',
      'period': body['period'] ?? 'daily',
      'targetValue': body['targetValue'],
      'targetMin': body['targetMin'],
      'targetMax': body['targetMax'],
      'startsOn': body['startsOn'] ?? '2026-04-07',
      'endsOn': body['endsOn'],
      'isActive': body['isActive'] ?? true,
      'memo': body['memo'],
      'createdAt': _now(),
      'updatedAt': _now(),
    };
    goals.insert(0, record);
    return record;
  }

  Map<String, dynamic> updateGoal(String id, Map<String, dynamic> body) {
    final index = goals.indexWhere((row) => row['id'] == id);
    if (index < 0) return goals.isEmpty ? {} : goals.first;
    final updated = {
      ...goals[index],
      ...body,
      'updatedAt': _now(),
    };
    goals[index] = updated;
    return updated;
  }

  Map<String, dynamic> deleteGoal(String id) {
    goals.removeWhere((row) => row['id'] == id);
    return {'success': true};
  }

  List<Map<String, dynamic>> listBloodPressure(Map<String, dynamic> query) =>
      _filterByRange(bloodPressure, query);
  List<Map<String, dynamic>> listBloodGlucose(Map<String, dynamic> query) =>
      _filterByRange(bloodGlucose, query);
  List<Map<String, dynamic>> listMeals(Map<String, dynamic> query) =>
      _filterByRange(meals, query);
  List<Map<String, dynamic>> listWeight(Map<String, dynamic> query) =>
      _filterByRange(weights, query);
  List<Map<String, dynamic>> listActivity(Map<String, dynamic> query) =>
      _filterByRange(activities, query);

  Map<String, dynamic> createBloodPressure(Map<String, dynamic> body) {
    return _createRecord(
      bloodPressure,
      {
        'systolic': body['systolic'] ?? 120,
        'diastolic': body['diastolic'] ?? 80,
        'pulse': body['pulse'],
        'period': body['period'] ?? 'morning',
      },
      body,
    );
  }

  Map<String, dynamic> updateBloodPressure(
          String id, Map<String, dynamic> body) =>
      _updateRecord(bloodPressure, id, body);

  Map<String, dynamic> deleteBloodPressure(String id) {
    _deleteRecord(bloodPressure, id);
    return {'success': true};
  }

  Map<String, dynamic> createBloodGlucose(Map<String, dynamic> body) {
    return _createRecord(
      bloodGlucose,
      {
        'value': body['value'] ?? 100,
        'unit': body['unit'] ?? 'mg_dl',
        'timing': body['timing'] ?? 'fasting',
      },
      body,
    );
  }

  Map<String, dynamic> updateBloodGlucose(
          String id, Map<String, dynamic> body) =>
      _updateRecord(bloodGlucose, id, body);

  Map<String, dynamic> deleteBloodGlucose(String id) {
    _deleteRecord(bloodGlucose, id);
    return {'success': true};
  }

  Map<String, dynamic> createMeal(Map<String, dynamic> body) {
    return _createRecord(
      meals,
      {
        'items': body['items'] ?? '食事',
        'estimatedCalories': body['estimatedCalories'],
        'photoUri': body['photoUri'],
      },
      body,
    );
  }

  Map<String, dynamic> updateMeal(String id, Map<String, dynamic> body) =>
      _updateRecord(meals, id, body);

  Map<String, dynamic> deleteMeal(String id) {
    _deleteRecord(meals, id);
    return {'success': true};
  }

  Map<String, dynamic> createActivity(Map<String, dynamic> body) {
    return _createRecord(
      activities,
      {
        'steps': body['steps'],
        'activeMinutes': body['activeMinutes'],
        'caloriesBurned': body['caloriesBurned'],
      },
      body,
    );
  }

  Map<String, dynamic> updateActivity(String id, Map<String, dynamic> body) =>
      _updateRecord(activities, id, body);

  Map<String, dynamic> deleteActivity(String id) {
    _deleteRecord(activities, id);
    return {'success': true};
  }

  Map<String, dynamic> createWeight(Map<String, dynamic> body) {
    return _createRecord(
      weights,
      {'value': body['value'] ?? 68.0},
      body,
    );
  }

  Map<String, dynamic> updateWeight(String id, Map<String, dynamic> body) =>
      _updateRecord(weights, id, body);

  Map<String, dynamic> deleteWeight(String id) {
    _deleteRecord(weights, id);
    return {'success': true};
  }

  Map<String, dynamic> dailySummaryForCurrentState() =>
      dailySummary('2026-04-07');

  Map<String, dynamic> _createRecord(
    List<Map<String, dynamic>> list,
    Map<String, dynamic> requiredFields,
    Map<String, dynamic> body,
  ) {
    final now = _now();
    final record = {
      'id': _uuid(_next()),
      'recordedAt': body['recordedAt'] ?? now,
      'externalId': body['externalId'],
      'valueHash': body['valueHash'],
      'inputSource': body['inputSource'] ?? 'manual',
      'syncSource': body['syncSource'],
      'memo': body['memo'],
      'createdAt': now,
      'updatedAt': now,
      ...requiredFields,
    };
    list.insert(0, record);
    return {'record': record, 'duplicate': false};
  }

  Map<String, dynamic> _updateRecord(
      List<Map<String, dynamic>> list, String id, Map<String, dynamic> body) {
    final index = list.indexWhere((row) => row['id'] == id);
    if (index < 0) return list.isEmpty ? {} : {'record': list.first};
    final existing = list[index];
    final updated = {
      ...existing,
      ...body,
      'updatedAt': _now(),
    };
    list[index] = updated;
    return updated;
  }

  void _deleteRecord(List<Map<String, dynamic>> list, String id) {
    list.removeWhere((row) => row['id'] == id);
  }

  List<Map<String, dynamic>> _filterByRange(
      List<Map<String, dynamic>> list, Map<String, dynamic> query) {
    final from = query['from'] as String?;
    final to = query['to'] as String?;
    return list.where((row) {
      final date = (row['recordedAt'] as String).substring(0, 10);
      if (from != null && date.compareTo(from) < 0) return false;
      if (to != null && date.compareTo(to) > 0) return false;
      return true;
    }).toList();
  }

  int _next() => _nextId++;

  String _now() => '2026-04-07T09:00:00.000Z';
}

Map<String, dynamic> _bp(
  int id, {
  required String recordedAt,
  required int systolic,
  required int diastolic,
  int? pulse,
  required String period,
}) =>
    {
      'id': _uuid(id),
      'recordedAt': recordedAt,
      'systolic': systolic,
      'diastolic': diastolic,
      'pulse': pulse,
      'period': period,
      'externalId': null,
      'valueHash': null,
      'inputSource': 'manual',
      'syncSource': null,
      'memo': null,
      'createdAt': recordedAt,
      'updatedAt': recordedAt,
    };

Map<String, dynamic> _glucose(
  int id, {
  required String recordedAt,
  required num value,
  required String unit,
  required String timing,
}) =>
    {
      'id': _uuid(id),
      'recordedAt': recordedAt,
      'value': value,
      'unit': unit,
      'timing': timing,
      'externalId': null,
      'valueHash': null,
      'inputSource': 'manual',
      'syncSource': null,
      'memo': null,
      'createdAt': recordedAt,
      'updatedAt': recordedAt,
    };

Map<String, dynamic> _meal(
  int id, {
  required String recordedAt,
  required String items,
  int? estimatedCalories,
}) =>
    {
      'id': _uuid(id),
      'recordedAt': recordedAt,
      'items': items,
      'estimatedCalories': estimatedCalories,
      'externalId': null,
      'valueHash': null,
      'inputSource': 'manual',
      'syncSource': null,
      'memo': null,
      'createdAt': recordedAt,
      'updatedAt': recordedAt,
    };

Map<String, dynamic> _weight(
  int id, {
  required String recordedAt,
  required num value,
}) =>
    {
      'id': _uuid(id),
      'recordedAt': recordedAt,
      'value': value,
      'externalId': null,
      'valueHash': null,
      'inputSource': 'manual',
      'syncSource': null,
      'memo': null,
      'createdAt': recordedAt,
      'updatedAt': recordedAt,
    };

Map<String, dynamic> _activity(
  int id, {
  required String recordedAt,
  int? steps,
  int? activeMinutes,
  int? caloriesBurned,
}) =>
    {
      'id': _uuid(id),
      'recordedAt': recordedAt,
      'steps': steps,
      'activeMinutes': activeMinutes,
      'caloriesBurned': caloriesBurned,
      'externalId': null,
      'valueHash': null,
      'inputSource': 'manual',
      'syncSource': null,
      'memo': null,
      'createdAt': recordedAt,
      'updatedAt': recordedAt,
    };

Map<String, dynamic> _goal(int id,
        {required String goalType,
        num? targetValue,
        required String startsOn}) =>
    {
      'id': _uuid(id),
      'goalType': goalType,
      'period': 'daily',
      'targetValue': targetValue,
      'targetMin': null,
      'targetMax': null,
      'startsOn': startsOn,
      'endsOn': null,
      'isActive': true,
      'memo': null,
      'createdAt': '2026-04-07T09:00:00.000Z',
      'updatedAt': '2026-04-07T09:00:00.000Z',
    };

Map<String, dynamic> _reminder(String type, String time) => {
      'id': _uuid(Random(type.hashCode).nextInt(1000) + 400),
      'reminderType': type,
      'isEnabled': true,
      'localTime': time,
      'daysOfWeek': ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      'timeZone': kAppTimeZone,
      'memo': null,
      'createdAt': '2026-04-07T09:00:00.000Z',
      'updatedAt': '2026-04-07T09:00:00.000Z',
    };

Map<String, dynamic> _sync() => {
      'id': _uuid(500),
      'isEnabled': true,
      'intervalHours': 6,
      'wifiOnly': false,
      'lastSyncedAt': '2026-04-07T09:00:00.000Z',
      'memo': null,
      'createdAt': '2026-04-07T09:00:00.000Z',
      'updatedAt': '2026-04-07T09:00:00.000Z',
    };

Map<String, dynamic> _device(int id) => {
      'id': _uuid(id),
      'platform': 'ios',
      'deviceToken': 'mock-device-token',
      'pushEnabled': true,
      'lastSeenAt': '2026-04-07T09:00:00.000Z',
      'createdAt': '2026-04-07T09:00:00.000Z',
      'updatedAt': '2026-04-07T09:00:00.000Z',
    };

String _uuid(int id) =>
    '00000000-0000-0000-0000-${id.toString().padLeft(12, '0')}';

double? average(Iterable<num> values) {
  final list = values.toList();
  if (list.isEmpty) return null;
  return list.reduce((a, b) => a + b) / list.length;
}

int? _calculateBmr({
  required double? weightKg,
  required double? heightCm,
  required int? age,
  required String? gender,
}) {
  if (weightKg == null || heightCm == null || age == null) return null;
  if (gender != 'male' && gender != 'female') return null;
  final s = gender == 'male' ? 5 : -161;
  final bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;
  return bmr.round();
}
