import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

GoRouter buildAppRouter({Object? homeDio}) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Router bootstrap deprecated')),
        ),
      ),
    ],
  );
}

final GoRouter appRouter = buildAppRouter();
