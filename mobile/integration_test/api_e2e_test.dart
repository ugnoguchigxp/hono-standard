import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/intl.dart';

import 'test_support.dart';

Future<void> main() async {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final backendAvailable = await isBackendAvailable();

  testWidgets(
    '実 API で登録・目標設定・記録保存・UI 保存までできる',
    (tester) async {
      final store = MemorySessionStore();
      final controller = await pumpApp(tester, store: store);

      final stamp = DateTime.now().microsecondsSinceEpoch;
      final email = 'e2e+$stamp@example.com';
      const password = 'Password123!';
      const name = 'E2E User';
      const weightKg = 68.4;
      const age = 34;
      const heightCm = 170.0;
      const gender = 'male';
      const activityLevel = 'moderate';

      await register(
        tester,
        name: name,
        email: email,
        password: password,
      );
      await waitForFinder(
        tester,
        find.byKey(const Key('app_shell_menu_button')),
      );
      expect(controller.isAuthenticated, isTrue);

      await controller.api.createWeight({
        'recordedAt': DateTime.now().toUtc().toIso8601String(),
        'timeZone': 'Asia/Tokyo',
        'value': weightKg,
        'inputSource': 'manual',
      });
      await controller.api.updateHealthProfile({
        'age': age,
        'gender': gender,
        'heightCm': heightCm,
        'activityLevel': activityLevel,
      });
      final profile = await controller.api.getHealthProfile();
      expect(profile['age'], age);
      expect(profile['gender'], gender);
      expect((profile['heightCm'] as num?)?.toDouble(), heightCm);
      expect(profile['activityLevel'], activityLevel);

      final expectedTdee = calculateTdee(
        weightKg: (profile['latestWeightKg'] as num).toDouble(),
        heightCm: (profile['heightCm'] as num).toDouble(),
        age: profile['age'] as int,
        gender: profile['gender'] as String,
        activityLevel: profile['activityLevel'] as String,
      );

      await openDrawerPage(tester, '設定');
      await openDrawerPage(tester, '今日のダッシュボード');

      await controller.api.createHealthGoal({
        'goalType': 'daily_calorie_limit',
        'period': 'daily',
        'targetValue': expectedTdee,
        'startsOn': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'isActive': true,
        'memo': 'E2E で作成',
      });

      final goals = await controller.api.getHealthGoals();
      final createdGoal = (goals['records'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>()
          .any(
            (goal) =>
                goal['goalType'] == 'daily_calorie_limit' &&
                goal['targetValue'] == expectedTdee,
          );
      expect(createdGoal, isTrue);

      await openDrawerPage(tester, '今日のダッシュボード');

      await controller.api.createBloodPressure({
        'recordedAt': DateTime.now().toUtc().toIso8601String(),
        'timeZone': 'Asia/Tokyo',
        'systolic': 130,
        'diastolic': 85,
        'pulse': 72,
        'period': 'morning',
        'inputSource': 'manual',
      });
      final bloodPressureRecords = await controller.api.listBloodPressure();
      final createdBloodPressure =
          (bloodPressureRecords['records'] as List<dynamic>? ?? const [])
              .cast<Map<String, dynamic>>()
              .any((record) =>
                  record['systolic'] == 130 && record['diastolic'] == 85);
      expect(createdBloodPressure, isTrue);

      await controller.api.createBloodGlucose({
        'recordedAt': DateTime.now().toUtc().toIso8601String(),
        'timeZone': 'Asia/Tokyo',
        'value': 110,
        'unit': 'mg_dl',
        'timing': 'fasting',
        'inputSource': 'manual',
      });
      final bloodGlucoseRecords = await controller.api.listBloodGlucose();
      final createdBloodGlucose =
          (bloodGlucoseRecords['records'] as List<dynamic>? ?? const [])
              .cast<Map<String, dynamic>>()
              .any((record) => record['value'] == 110);
      expect(createdBloodGlucose, isTrue);

      await controller.api.createWeight({
        'recordedAt': DateTime.now().toUtc().toIso8601String(),
        'timeZone': 'Asia/Tokyo',
        'value': 69.1,
        'inputSource': 'manual',
      });
      final weightRecords = await controller.api.listWeight();
      final createdWeight =
          (weightRecords['records'] as List<dynamic>? ?? const [])
              .cast<Map<String, dynamic>>()
              .any((record) => (record['value'] as num?)?.toDouble() == 69.1);
      expect(createdWeight, isTrue);

      await controller.api.createActivity({
        'recordedAt': DateTime.now().toUtc().toIso8601String(),
        'timeZone': 'Asia/Tokyo',
        'steps': 12000,
        'activeMinutes': 60,
        'caloriesBurned': 420,
        'inputSource': 'manual',
      });
      final activityRecords = await controller.api.getActivityRecords();
      final createdActivity =
          (activityRecords['records'] as List<dynamic>? ?? const [])
              .cast<Map<String, dynamic>>()
              .any((record) => record['steps'] == 12000);
      expect(createdActivity, isTrue);

      final createdMeal = await controller.api.createMeal({
        'recordedAt': DateTime.now().toUtc().toIso8601String(),
        'timeZone': 'Asia/Tokyo',
        'items': 'テスト定食',
        'estimatedCalories': 680,
        'inputSource': 'manual',
      });
      final mealRecords = await controller.api.listMeals();
      final createdMealFound =
          (mealRecords['records'] as List<dynamic>? ?? const [])
              .cast<Map<String, dynamic>>()
              .any((record) => record['items'] == 'テスト定食');
      expect(createdMealFound, isTrue);

      await controller.api.updateMeal(
        (createdMeal['record'] as Map<String, dynamic>)['id'] as String,
        {
          'recordedAt': DateTime.now().toUtc().toIso8601String(),
          'timeZone': 'Asia/Tokyo',
          'items': '修正版定食',
          'estimatedCalories': 700,
          'inputSource': 'manual',
        },
      );
      final updatedMealRecords = await controller.api.listMeals();
      final editedMeal =
          (updatedMealRecords['records'] as List<dynamic>? ?? const [])
              .cast<Map<String, dynamic>>()
              .any((record) => record['items'] == '修正版定食');
      expect(editedMeal, isTrue);

      await openMetricDetail(tester, '最新 体重');
      await waitForFinder(tester, find.byTooltip('新規入力'));
      await tester.tap(find.byTooltip('新規入力').first);
      await tester.pumpAndSettle();

      final uiRecordedAt = DateFormat("yyyy-MM-dd'T'HH:mm")
          .format(DateTime.now().add(const Duration(hours: 1)));
      await tester.enterText(
        find.byKey(const Key('recorded_at_field')),
        uiRecordedAt,
      );
      await tester.enterText(
        find.byKey(const Key('weight_value_field')),
        '72.3',
      );
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      await tester.dragUntilVisible(
        find.byKey(const Key('record_save_button')),
        find.byType(SingleChildScrollView),
        const Offset(0, -250),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('record_save_button')));
      await tester.pumpAndSettle();

      final savedProfile = await controller.api.getHealthProfile();
      expect((savedProfile['latestWeightKg'] as num?)?.toDouble(), 72.3);
    },
    skip: !backendAvailable,
  );

  testWidgets(
    'Hono が起動していない場合は接続エラーを表示する',
    (tester) async {
      final store = MemorySessionStore();
      await pumpApp(tester, store: store);

      await waitForFinder(
        tester,
        find.text('認証方式の取得に失敗しました。Hono が起動していない可能性があります。'),
      );

      await login(
        tester,
        email: 'missing@example.com',
        password: 'Password123!',
      );

      await waitForFinder(
        tester,
        find.text('サーバーに接続できません。Hono が起動しているか確認してください。'),
      );
      expect(find.byKey(const Key('auth_login_button')), findsOneWidget);
      expect(find.text('今日のダッシュボード'), findsNothing);
    },
    skip: backendAvailable,
  );
}
