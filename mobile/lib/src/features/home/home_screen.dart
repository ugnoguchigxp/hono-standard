import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/dio_client.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.dio});

  final Dio? dio;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final Dio _dio;
  Map<String, dynamic>? _summary;
  String? _error;

  @override
  void initState() {
    super.initState();
    _dio = widget.dio ?? buildDio();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
    });
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/v1/health/summary/daily',
        options: Options(
          headers: {},
          validateStatus: (s) => s != null && s < 500,
        ),
      );
      if (res.statusCode == 401) {
        setState(() => _error = '認証が必要です（Web と同じセッション or Bearer）');
        return;
      }
      setState(() => _summary = res.data);
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ホーム')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            FilledButton(
              onPressed: () => context.push('/summary'),
              child: const Text('サマリ画面へ'),
            ),
            const SizedBox(height: 12),
            FilledButton.tonal(
              onPressed: () => context.push('/insights'),
              child: const Text('予防ケア画面へ'),
            ),
            const SizedBox(height: 24),
            if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            if (_summary != null) ...[
              Text('歩数: ${_summary!['stepsTotal']}', style: Theme.of(context).textTheme.titleLarge),
              Text('食事: ${_summary!['mealCount']} 件'),
              Text('活動 kcal: ${_summary!['activityCaloriesTotal']}'),
            ],
            const SizedBox(height: 24),
            const Text(
              'API_BASE_URL は flutter run --dart-define=API_BASE_URL=... で指定。\nUSE_MOCK=true で組み込みダミー応答。',
              style: TextStyle(fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
