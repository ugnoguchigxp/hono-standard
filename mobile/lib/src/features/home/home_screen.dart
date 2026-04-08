import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:fquery/fquery.dart';
import 'package:fquery_core/fquery_core.dart';
import 'package:intl/intl.dart';

import '../../core/query/health_query_keys.dart';
import '../../core/session/app_controller.dart';
import 'metric_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {

  Future<Map<String, dynamic>> _loadSnapshot() async {
    final now = DateTime.now();
    final today = DateFormat('yyyy-MM-dd').format(now);
    final weekAgo = DateFormat('yyyy-MM-dd').format(now.subtract(const Duration(days: 7)));

    final summary = await widget.controller.api.getDailySummary(date: today);
    final weights = await widget.controller.api.listWeight(from: weekAgo, to: today);

    return {
      'summary': summary,
      'weights': weights,
    };
  }

  Future<void> _openDetail(String kind, String title, IconData icon, Color color) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => MetricDetailScreen(
          controller: widget.controller,
          kind: kind,
          title: title,
          icon: icon,
          color: color,
        ),
      ),
    );
  }

  num _overallScore(Map<String, dynamic> summary, Map<String, dynamic>? latestWeight) {
    final latestBp = summary['latestBloodPressure'] as Map<String, dynamic>?;
    final latestGlucose = summary['latestBloodGlucose'] as Map<String, dynamic>?;
    final bpScore = latestBp == null
        ? 10
        : _rangeScore(latestBp['systolic'], 105, 135) + _rangeScore(latestBp['diastolic'], 65, 85);
    final glucoseScore = latestGlucose == null ? 10 : _rangeScore(latestGlucose['value'], 75, 130);
    final activityScore = _rangeScore(summary['stepsTotal'], 3000, 9000);
    final mealScore = _rangeScore(7 - (summary['mealCount'] ?? 0), 2, 7);
    final weightScore = latestWeight == null ? 10 : 18;
    return ((bpScore + glucoseScore + activityScore + mealScore + weightScore) / 5).round();
  }

  num _rangeScore(dynamic value, num low, num high) {
    if (value is! num) return 0;
    if (value <= low) return 0;
    if (value >= high) return 20;
    return ((value - low) / (high - low) * 20).clamp(0, 20);
  }

  @override
  Widget build(BuildContext context) {
    return QueryBuilder<Map<String, dynamic>, DioException>(
      options: QueryOptions<Map<String, dynamic>, DioException>(
        queryKey: healthDashboardQuery(),
        queryFn: _loadSnapshot,
      ),
      builder: (context, result) {
        return RefreshIndicator(
          onRefresh: () async {
            await result.refetch();
          },
          child: _buildBody(result),
        );
      },
    );
  }

  Widget _buildBody(QueryResult<Map<String, dynamic>, DioException> result) {
    if (result.isLoading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: const [
          SizedBox(height: 120),
          Center(child: CircularProgressIndicator()),
        ],
      );
    }
    if (result.isError || result.data == null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [Text('読み込み失敗: ${result.error}')],
      );
    }

    final data = result.data ?? const <String, dynamic>{};
    final summary = (data['summary'] as Map<String, dynamic>? ?? const {});
    final weights = (data['weights'] as Map<String, dynamic>? ?? const {});
    final latestWeight = ((weights['records'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>()
            .isNotEmpty)
        ? (weights['records'] as List<dynamic>).first as Map<String, dynamic>
        : null;
    final overallScore = _overallScore(summary, latestWeight);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _SummaryScoreCard(score: overallScore),
        const SizedBox(height: 16),
        _MetricGrid(
          summary: summary,
          latestWeight: latestWeight,
          onOpenDetail: _openDetail,
        ),
      ],
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({
    required this.summary,
    required this.latestWeight,
    required this.onOpenDetail,
  });

  final Map<String, dynamic> summary;
  final Map<String, dynamic>? latestWeight;
  final Future<void> Function(String kind, String title, IconData icon, Color color) onOpenDetail;

  @override
  Widget build(BuildContext context) {
    final latestBp = summary['latestBloodPressure'] as Map<String, dynamic>?;
    final latestGlucose = summary['latestBloodGlucose'] as Map<String, dynamic>?;
    final weightValue = latestWeight?['value'];

    return GridView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        mainAxisExtent: 162,
      ),
      children: [
        _MetricCard(
          icon: Icons.directions_walk_rounded,
          title: '歩数',
          value: (summary['stepsTotal'] ?? 0).toString(),
          subtitle: '活動 ${summary['activityCaloriesTotal'] ?? 0} kcal',
          color: Colors.blue,
          onTap: () => onOpenDetail('activity', '運動', Icons.directions_walk_rounded, Colors.blue),
        ),
        _MetricCard(
          icon: Icons.restaurant_rounded,
          title: '食事',
          value: '${summary['mealCount'] ?? 0} 件',
          subtitle: '今日の記録数',
          color: Colors.orange,
          onTap: () => onOpenDetail('meal', '食事', Icons.restaurant_rounded, Colors.orange),
        ),
        _MetricCard(
          icon: Icons.monitor_heart_rounded,
          title: '最新 血圧',
          value: latestBp == null ? '—' : '${latestBp['systolic']} / ${latestBp['diastolic']}',
          subtitle: latestBp?['pulse'] != null ? '脈拍 ${latestBp?['pulse']}' : 'mmHg',
          color: Colors.red,
          onTap: () => onOpenDetail('blood_pressure', '血圧', Icons.monitor_heart_rounded, Colors.red),
        ),
        _MetricCard(
          icon: Icons.water_drop_rounded,
          title: '最新 血糖',
          value: latestGlucose == null ? '—' : '${latestGlucose['value']}',
          subtitle: latestGlucose == null ? '—' : '${latestGlucose['unit']}',
          color: Colors.teal,
          onTap: () => onOpenDetail('blood_glucose', '血糖', Icons.water_drop_rounded, Colors.teal),
        ),
        _MetricCard(
          icon: Icons.scale_rounded,
          title: '最新 体重',
          value: weightValue == null ? '—' : weightValue.toString(),
          subtitle: weightValue == null ? '—' : 'kg',
          color: Colors.grey,
          onTap: () => onOpenDetail('weight', '体重', Icons.scale_rounded, Colors.grey),
        ),
      ],
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String value;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.max,
            children: [
              Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.all(8),
                    child: Icon(icon, color: color),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right_rounded),
                ],
              ),
              const SizedBox(height: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.labelMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryScoreCard extends StatelessWidget {
  const _SummaryScoreCard({required this.score});

  final num score;

  @override
  Widget build(BuildContext context) {
    final value = score.clamp(0, 100).toInt();
    final color = value >= 80
        ? Colors.green
        : value >= 60
            ? Colors.orange
            : Colors.red;
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              padding: const EdgeInsets.all(12),
              child: Icon(Icons.emoji_events_rounded, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('総合得点', style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 4),
                  Text(
                    '$value',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  const Text('血圧・血糖・食事・運動・体重をまとめたスコアです'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
