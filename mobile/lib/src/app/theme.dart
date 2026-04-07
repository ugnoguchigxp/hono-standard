import 'package:flutter/material.dart';

ThemeData buildAppTheme() {
  const seed = Color(0xFF0D9488);
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: Brightness.light),
    appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
  );
}
