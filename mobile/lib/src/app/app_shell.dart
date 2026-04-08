import 'package:flutter/material.dart';

import '../core/session/app_controller.dart';
import '../features/auth/auth_screen_view.dart';
import '../features/home/home_screen.dart';
import '../features/insights/insights_screen.dart';

class AuthScreen extends StatelessWidget {
  const AuthScreen({super.key, required this.controller});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return AuthScreenView(controller: controller);
  }
}

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.controller});

  final AppController controller;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _selectedIndex = 0;

  late final List<Widget> _pages = [
    HomeScreen(controller: widget.controller),
    InsightsScreen(controller: widget.controller),
  ];

  final _labels = const ['今日のダッシュボード', '設定'];
  final _icons = const [Icons.dashboard_rounded, Icons.tune_rounded];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: Builder(
          builder: (context) => IconButton(
            key: const Key('app_shell_menu_button'),
            icon: const Icon(Icons.menu_rounded),
            tooltip: MaterialLocalizations.of(context).openAppDrawerTooltip,
            onPressed: () => Scaffold.of(context).openDrawer(),
          ),
        ),
        title: Text(_labels[_selectedIndex]),
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: [
              DrawerHeader(
                child: Align(
                  alignment: Alignment.bottomLeft,
                  child: Text(
                    'Hono Health',
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              for (var i = 0; i < _labels.length; i++)
                ListTile(
                  leading: Icon(_icons[i]),
                  title: Text(_labels[i]),
                  selected: _selectedIndex == i,
                  onTap: () {
                    Navigator.of(context).pop();
                    setState(() => _selectedIndex = i);
                  },
                ),
            ],
          ),
        ),
      ),
      body: IndexedStack(index: _selectedIndex, children: _pages),
    );
  }
}
