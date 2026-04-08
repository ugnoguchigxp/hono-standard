import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'src/app/app_shell.dart';
import 'src/app/theme.dart';
import 'src/core/session/app_controller.dart';

/// API ベース URL: `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5173`
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const HonoHealthApp());
}

class HonoHealthApp extends StatefulWidget {
  const HonoHealthApp({super.key, this.controller});

  final AppController? controller;

  @override
  State<HonoHealthApp> createState() => _HonoHealthAppState();
}

class _HonoHealthAppState extends State<HonoHealthApp> {
  late final AppController _controller = widget.controller ?? AppController();

  @override
  void initState() {
    super.initState();
    _controller.initialize();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Hono Health',
      theme: buildAppTheme(),
      home: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          if (_controller.isLoading) {
            return const _BootScreen();
          }
          if (!_controller.isAuthenticated) {
            return AuthScreen(controller: _controller);
          }
          return AppShell(controller: _controller);
        },
      ),
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

class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('セッションを確認しています'),
          ],
        ),
      ),
    );
  }
}
