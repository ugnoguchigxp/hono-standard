import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';

import 'src/app/app_router.dart';
import 'src/app/theme.dart';

/// API ベース URL: `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5173`
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HonoHealthApp());
}

class HonoHealthApp extends StatelessWidget {
  const HonoHealthApp({super.key, this.router});

  final GoRouter? router;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Hono Health',
      theme: buildAppTheme(),
      routerConfig: router ?? appRouter,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('ja'),
        Locale('en'),
      ],
    );
  }
}
