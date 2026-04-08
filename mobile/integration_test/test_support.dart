import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hono_health_mobile/main.dart';
import 'package:hono_health_mobile/src/core/config/env.dart';
import 'package:hono_health_mobile/src/core/session/app_controller.dart';
import 'package:hono_health_mobile/src/core/session/auth_session.dart';
import 'package:hono_health_mobile/src/core/storage/session_store.dart';

class MemorySessionStore extends SessionStore {
  AuthSession? _session;

  @override
  Future<AuthSession?> read() async => _session;

  @override
  Future<void> save(AuthSession session) async {
    _session = session;
  }

  @override
  Future<void> clear() async {
    _session = null;
  }
}

Future<AppController> pumpApp(
  WidgetTester tester, {
  required MemorySessionStore store,
}) async {
  final controller = AppController(store: store);
  await tester.pumpWidget(HonoHealthApp(controller: controller));
  await tester.pumpAndSettle();
  return controller;
}

Future<void> register(
  WidgetTester tester, {
  required String name,
  required String email,
  required String password,
}) async {
  await tester.tap(find.text('新規登録'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byKey(const Key('auth_register_name')), name);
  await tester.enterText(find.byKey(const Key('auth_register_email')), email);
  await tester.enterText(
    find.byKey(const Key('auth_register_password')),
    password,
  );
  await tester.tap(find.byKey(const Key('auth_register_button')));
  await tester.pumpAndSettle();
}

Future<void> login(
  WidgetTester tester, {
  required String email,
  required String password,
}) async {
  await tester.enterText(
    find.byKey(const Key('auth_login_email')),
    email,
  );
  await tester.enterText(
    find.byKey(const Key('auth_login_password')),
    password,
  );
  await tester.tap(find.byKey(const Key('auth_login_button')));
  await tester.pumpAndSettle();
}

Future<void> openDrawerPage(WidgetTester tester, String label) async {
  await waitForFinder(tester, find.byKey(const Key('app_shell_menu_button')));
  await tester.tap(find.byKey(const Key('app_shell_menu_button')));
  await tester.pumpAndSettle();
  await tester.tap(find.widgetWithText(ListTile, label));
  await tester.pumpAndSettle();
}

Future<void> openMetricDetail(WidgetTester tester, String cardTitle) async {
  await tester.tap(find.text(cardTitle).last);
  await tester.pumpAndSettle();
}

Future<void> goBack(WidgetTester tester) async {
  final backButton = find.byIcon(Icons.arrow_back);
  if (backButton.evaluate().isNotEmpty) {
    await tester.tap(backButton.first);
  } else {
    await tester.binding.handlePopRoute();
  }
  await tester.pumpAndSettle();
}

Future<void> waitForFinder(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 20),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline) && finder.evaluate().isEmpty) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(finder, findsOneWidget);
}

Future<void> waitForGone(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 20),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline) && finder.evaluate().isNotEmpty) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  expect(finder, findsNothing);
}

Future<bool> isBackendAvailable() async {
  final client = HttpClient()..connectionTimeout = const Duration(seconds: 2);
  try {
    final uri = Uri.parse(Env.apiBaseUrl).resolve('/api/auth/methods');
    final request = await client.getUrl(uri);
    final response = await request.close().timeout(const Duration(seconds: 2));
    await response.drain<void>();
    return response.statusCode >= 200 && response.statusCode < 500;
  } catch (_) {
    return false;
  } finally {
    client.close(force: true);
  }
}

int calculateBmr({
  required double weightKg,
  required double heightCm,
  required int age,
  required String gender,
}) {
  final s = gender == 'male' ? 5 : -161;
  return (10 * weightKg + 6.25 * heightCm - 5 * age + s).round();
}

int calculateTdee({
  required double weightKg,
  required double heightCm,
  required int age,
  required String gender,
  required String activityLevel,
}) {
  const multiplier = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9,
  };
  final bmr = calculateBmr(
    weightKg: weightKg,
    heightCm: heightCm,
    age: age,
    gender: gender,
  );
  return (bmr * multiplier[activityLevel]!).round();
}
