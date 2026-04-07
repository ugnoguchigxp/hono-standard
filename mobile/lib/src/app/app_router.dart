import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../features/home/home_screen.dart';
import '../features/insights/insights_screen.dart';
import '../features/summary/summary_screen.dart';

final GlobalKey<NavigatorState> _rootNavKey = GlobalKey<NavigatorState>();

GoRouter buildAppRouter({Dio? homeDio}) {
  return GoRouter(
    navigatorKey: _rootNavKey,
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => HomeScreen(dio: homeDio),
      ),
      GoRoute(
        path: '/summary',
        builder: (context, state) => const SummaryScreen(),
      ),
      GoRoute(
        path: '/insights',
        builder: (context, state) => const InsightsScreen(),
      ),
    ],
  );
}

final GoRouter appRouter = buildAppRouter();
