import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:fquery/fquery.dart';
import 'package:fquery_core/fquery_core.dart';
import 'package:intl/intl.dart';

import '../../core/query/health_query_keys.dart';
import '../../core/session/app_controller.dart';
import '../goals/goal_editor_sheet.dart';
import '../records/record_editor_sheet.dart';

class MetricDetailScreen extends StatefulWidget {
  const MetricDetailScreen({
    super.key,
    required this.controller,
    required this.kind,
    required this.title,
    required this.icon,
    required this.color,
  });

  final AppController controller;
  final String kind;
  final String title;
  final IconData icon;
  final Color color;

  @override
  State<MetricDetailScreen> createState() => _MetricDetailScreenState();
}

class _MetricDetailScreenState extends State<MetricDetailScreen> {
  late DateTime _from = DateTime.now().subtract(const Duration(days: 30));
  late DateTime _to = DateTime.now();

  Future<_MetricDetailSnapshot> _loadSnapshot() async {
    final from = DateFormat('yyyy-MM-dd').format(_from);
    final to = DateFormat('yyyy-MM-dd').format(_to);
    final recordsFuture = switch (widget.kind) {
      'blood_pressure' =>
        widget.controller.api.listBloodPressure(from: from, to: to),
      'blood_glucose' =>
        widget.controller.api.listBloodGlucose(from: from, to: to),
      'meal' => widget.controller.api.listMeals(from: from, to: to),
      'weight' => widget.controller.api.listWeight(from: from, to: to),
      'activity' =>
        widget.controller.api.getActivityRecords(from: from, to: to),
      _ => widget.controller.api.listWeight(from: from, to: to),
    };
    final goalsFuture = widget.controller.api.getHealthGoals();
    Map<String, dynamic> goalAchievementsResponse = const {'items': []};
    try {
      goalAchievementsResponse =
          await widget.controller.api.getGoalAchievements(date: to);
    } catch (_) {
      goalAchievementsResponse = const {'items': []};
    }
    final results = await Future.wait([recordsFuture, goalsFuture]);
    final response = Map<String, dynamic>.from(results[0] as Map);
    final goalsResponse = Map<String, dynamic>.from(results[1] as Map);
    final records = _mapRecords(response);
    final goals = _mapGoals(goalsResponse);
    final goalAchievements = _mapGoalAchievements(goalAchievementsResponse);
    return _MetricDetailSnapshot(
      records: records,
      goals: goals,
      goalAchievements: goalAchievements,
      points: _buildPrimaryTrendPoints(records),
      secondaryPoints: _buildSecondaryTrendPoints(records),
    );
  }

  List<_MetricEntry> _mapRecords(Map<String, dynamic> response) {
    final records = response['records'] as List<dynamic>? ?? const [];
    return records
        .map((record) => _MetricEntry.fromKind(
            widget.kind, Map<String, dynamic>.from(record as Map)))
        .toList()
      ..sort((a, b) => b.recordedAt.compareTo(a.recordedAt));
  }

  List<Map<String, dynamic>> _mapGoals(Map<String, dynamic> response) {
    final goals = response['records'] as List<dynamic>? ?? const [];
    final allowed = _goalTypesForKind(widget.kind).toSet();
    return goals
        .whereType<Map<String, dynamic>>()
        .map((goal) => Map<String, dynamic>.from(goal))
        .where((goal) => allowed.contains(goal['goalType'] as String?))
        .toList();
  }

  Map<String, Map<String, dynamic>> _mapGoalAchievements(
      Map<String, dynamic> response) {
    final items = response['items'] as List<dynamic>? ?? const [];
    final mapped = <String, Map<String, dynamic>>{};
    for (final item in items.whereType<Map<String, dynamic>>()) {
      final achievement = Map<String, dynamic>.from(item);
      final goal = achievement['goal'];
      if (goal is Map<String, dynamic>) {
        final goalId = goal['id'] as String?;
        if (goalId != null) {
          mapped[goalId] = achievement;
        }
      }
    }
    return mapped;
  }

  List<_TrendPoint> _buildPrimaryTrendPoints(List<_MetricEntry> records) {
    switch (widget.kind) {
      case 'blood_pressure':
        return _dailyTrend(
            records, (entry) => entry.record['systolic'] as num?);
      case 'blood_glucose':
        return _dailyTrend(records, (entry) => entry.record['value'] as num?);
      case 'meal':
        return _dailyTrend(
          records,
          (entry) => entry.record['estimatedCalories'] as num? ?? 1,
          aggregate: _sumTrend,
        );
      case 'weight':
        return _dailyTrend(records, (entry) => entry.record['value'] as num?);
      case 'activity':
        return _dailyTrend(
          records,
          (entry) =>
              entry.record['steps'] as num? ??
              entry.record['caloriesBurned'] as num? ??
              entry.record['activeMinutes'] as num?,
          aggregate: _sumTrend,
        );
      default:
        return const [];
    }
  }

  List<_TrendPoint> _buildSecondaryTrendPoints(List<_MetricEntry> records) {
    if (widget.kind != 'blood_pressure') return const [];
    return _dailyTrend(records, (entry) => entry.record['diastolic'] as num?);
  }

  List<_TrendPoint> _dailyTrend(
    List<_MetricEntry> records,
    num? Function(_MetricEntry entry) selector, {
    num Function(List<num> values)? aggregate,
  }) {
    final byDay = <String, List<num>>{};
    for (final record in records) {
      final value = selector(record);
      if (value == null) continue;
      final day = DateFormat('yyyy-MM-dd').format(record.recordedAt);
      byDay.putIfAbsent(day, () => []).add(value);
    }
    final entries = byDay.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return entries
        .map(
          (entry) => _TrendPoint(
            date: entry.key,
            value: (aggregate ?? _averageTrend)(entry.value),
          ),
        )
        .toList();
  }

  num _averageTrend(List<num> values) =>
      values.reduce((a, b) => a + b) / values.length;

  num _sumTrend(List<num> values) =>
      values.fold<num>(0, (sum, value) => sum + value);

  Future<void> _createRecord() async {
    final cache = CacheProvider.get(context);
    final saved = await showRecordEditorSheet(
      context,
      controller: widget.controller,
      initialKind: widget.kind,
    );
    if (saved) cache.invalidateQueries(['health']);
  }

  Future<void> _editRecord(_MetricEntry entry) async {
    final cache = CacheProvider.get(context);
    final saved = await showRecordEditorSheet(
      context,
      controller: widget.controller,
      initialKind: widget.kind,
      record: entry.record,
    );
    if (saved) cache.invalidateQueries(['health']);
  }

  Future<void> _deleteRecord(_MetricEntry entry) async {
    final cache = CacheProvider.get(context);
    final shouldDelete = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('削除しますか'),
            content: Text('${widget.title} の記録を削除します。'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('キャンセル'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('削除'),
              ),
            ],
          ),
        ) ??
        false;
    if (!shouldDelete) return;

    try {
      final api = widget.controller.api;
      switch (widget.kind) {
        case 'blood_pressure':
          await api.deleteBloodPressure(entry.record['id'] as String);
          break;
        case 'blood_glucose':
          await api.deleteBloodGlucose(entry.record['id'] as String);
          break;
        case 'meal':
          await api.deleteMeal(entry.record['id'] as String);
          break;
        case 'weight':
          await api.deleteWeight(entry.record['id'] as String);
          break;
      case 'activity':
          await api.deleteActivity(entry.record['id'] as String);
          break;
      }
      cache.invalidateQueries(['health']);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('削除に失敗しました: $error')),
      );
    }
  }

  Future<void> _saveGoal({Map<String, dynamic>? goal}) async {
    final cache = CacheProvider.get(context);
    Map<String, dynamic>? profile;
    try {
      profile = await widget.controller.api.getHealthProfile();
    } catch (_) {
      profile = null;
    }
    if (!mounted) return;
    final payload = await showGoalEditorSheet(
      context,
      allowedGoalTypes: _goalTypesForKind(widget.kind),
      goal: goal,
      profile: profile,
    );
    if (payload == null) return;

    try {
      if (goal == null) {
        await widget.controller.api.createHealthGoal(payload.toJson());
      } else {
        await widget.controller.api
            .updateHealthGoal(goal['id'] as String, payload.toJson());
      }
      cache.invalidateQueries(['health']);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('目標の保存に失敗しました: $error')),
      );
    }
  }

  Future<void> _deleteGoal(Map<String, dynamic> goal) async {
    final cache = CacheProvider.get(context);
    final shouldDelete = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('目標を削除しますか'),
            content: Text(
                '${_goalTypeLabel(goal['goalType'] as String? ?? '')} を削除します。'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('キャンセル'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('削除'),
              ),
            ],
          ),
        ) ??
        false;
    if (!shouldDelete) return;

    try {
      await widget.controller.api.deleteHealthGoal(goal['id'] as String);
      cache.invalidateQueries(['health']);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('目標の削除に失敗しました: $error')),
      );
    }
  }

  Future<void> _pickFromDate() async {
    final cache = CacheProvider.get(context);
    final picked = await showDatePicker(
      context: context,
      initialDate: _from,
      firstDate: DateTime(2020),
      lastDate: _to,
    );
    if (picked != null) {
      setState(() => _from = picked);
      cache.invalidateQueries(['health']);
    }
  }

  Future<void> _pickToDate() async {
    final cache = CacheProvider.get(context);
    final picked = await showDatePicker(
      context: context,
      initialDate: _to,
      firstDate: _from,
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _to = picked);
      cache.invalidateQueries(['health']);
    }
  }

  @override
  Widget build(BuildContext context) {
    return QueryBuilder<_MetricDetailSnapshot, DioException>(
      options: QueryOptions<_MetricDetailSnapshot, DioException>(
        queryKey: healthDetailQuery(
          widget.kind,
          DateFormat('yyyy-MM-dd').format(_from),
          DateFormat('yyyy-MM-dd').format(_to),
        ),
        queryFn: _loadSnapshot,
      ),
      builder: (context, result) {
        return Scaffold(
          appBar: AppBar(
            title: Text(widget.title),
            actions: [
              IconButton(
                onPressed: _createRecord,
                icon: const Icon(Icons.add_rounded),
                tooltip: '新規入力',
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () async {
              await result.refetch();
            },
            child: _buildBody(context, result),
          ),
        );
      },
    );
  }

  Widget _buildBody(
    BuildContext context,
    QueryResult<_MetricDetailSnapshot, DioException> result,
  ) {
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

    final data = result.data ??
        const _MetricDetailSnapshot(
          records: [],
          goals: [],
          goalAchievements: {},
          points: [],
          secondaryPoints: [],
        );
    final summary = _summaryFor(data.records);
    final chart = _buildChartData(data.records);
    final goals = data.goals;
    final goalAchievements = data.goalAchievements;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _SectionCard(
          title: '目標',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'この項目ごとに目標を設定できます。',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: () => _saveGoal(),
                icon: const Icon(Icons.flag_rounded),
                label: const Text('目標を設定'),
              ),
              const SizedBox(height: 16),
              if (goals.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text('この項目に設定された目標はまだありません。'),
                )
              else
                ...goals.map(
                  (goal) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _GoalCard(
                      goal: goal,
                      achievement: goalAchievements[goal['id'] as String? ?? ''],
                      color: widget.color,
                      onEdit: () => _saveGoal(goal: goal),
                      onDelete: () => _deleteGoal(goal),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SummaryCard(
          title: '${widget.title} の総合',
          icon: widget.icon,
          color: widget.color,
          summary: summary,
        ),
        const SizedBox(height: 16),
        _TrendCard(
          title: '時系列',
          points: chart.primary,
          accent: widget.color,
          valueLabel: _trendLabel(),
          secondaryPoints: chart.secondary,
          secondaryAccent: _secondaryAccent(),
          secondaryLabel: chart.secondaryLabel,
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: 170,
              child: OutlinedButton(
                onPressed: _pickFromDate,
                child: Text('開始: ${DateFormat('MM/dd').format(_from)}'),
              ),
            ),
            SizedBox(
              width: 170,
              child: OutlinedButton(
                onPressed: _pickToDate,
                child: Text('終了: ${DateFormat('MM/dd').format(_to)}'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        Text(
          '${widget.title} の記録',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        if (data.records.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(child: Text('この期間の記録はありません。')),
          )
        else
          ...data.records.map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Card(
                elevation: 0,
                child: ListTile(
                  onTap: () => _editRecord(entry),
                  leading: CircleAvatar(
                    backgroundColor: widget.color.withValues(alpha: 0.12),
                    child: Icon(widget.icon, color: widget.color),
                  ),
                  title: Text(entry.title),
                  subtitle: Text(
                    '${DateFormat('yyyy/MM/dd HH:mm').format(entry.recordedAt)}\n${entry.subtitle}',
                  ),
                  isThreeLine: entry.subtitle.isNotEmpty,
                  trailing: Wrap(
                    spacing: 4,
                    children: [
                      IconButton(
                        onPressed: () => _editRecord(entry),
                        icon: const Icon(Icons.edit_rounded),
                      ),
                      IconButton(
                        onPressed: () => _deleteRecord(entry),
                        icon: const Icon(Icons.delete_rounded),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  String _trendLabel() {
    switch (widget.kind) {
      case 'blood_pressure':
        return '平均 収縮期';
      case 'blood_glucose':
        return '平均 血糖';
      case 'meal':
        return '日別';
      case 'weight':
        return '体重';
      case 'activity':
        return '日別';
      default:
        return '時系列';
    }
  }

  _SummaryData _summaryFor(List<_MetricEntry> records) {
    switch (widget.kind) {
      case 'blood_pressure':
        final latest = records.isEmpty ? null : records.first;
        final systolics =
            records.map((e) => e.record['systolic']).whereType<num>().toList();
        final diastolics =
            records.map((e) => e.record['diastolic']).whereType<num>().toList();
        return _SummaryData(
          primary: latest == null
              ? '—'
              : '${latest.record['systolic']} / ${latest.record['diastolic']}',
          secondary:
              '記録 ${records.length} 件 / 平均 ${_avg(systolics)} / ${_avg(diastolics)}',
        );
      case 'blood_glucose':
        final latest = records.isEmpty ? null : records.first;
        final values =
            records.map((e) => e.record['value']).whereType<num>().toList();
        return _SummaryData(
          primary: latest == null
              ? '—'
              : '${latest.record['value']} ${latest.record['unit']}',
          secondary: '記録 ${records.length} 件 / 平均 ${_avg(values)}',
        );
      case 'meal':
        final calories = records
            .map((e) => e.record['estimatedCalories'])
            .whereType<num>()
            .fold<num>(0, (sum, value) => sum + value);
        return _SummaryData(
          primary: '${records.length} 件',
          secondary:
              '推定 ${calories.round()} kcal / 直近 ${records.isEmpty ? '—' : records.first.title}',
        );
      case 'weight':
        final latest = records.isEmpty ? null : records.first;
        final earliest = records.isEmpty ? null : records.last;
        final delta = (latest != null && earliest != null)
            ? (latest.record['value'] as num) -
                (earliest.record['value'] as num)
            : null;
        return _SummaryData(
          primary: latest == null ? '—' : '${latest.record['value']} kg',
          secondary: delta == null
              ? '記録 ${records.length} 件'
              : '記録 ${records.length} 件 / 変化 ${delta >= 0 ? '+' : ''}${delta.toStringAsFixed(1)} kg',
        );
      case 'activity':
        final steps = records
            .map((e) => e.record['steps'])
            .whereType<num>()
            .fold<num>(0, (sum, value) => sum + value);
        final calories = records
            .map((e) => e.record['caloriesBurned'])
            .whereType<num>()
            .fold<num>(0, (sum, value) => sum + value);
        return _SummaryData(
          primary: '${steps.round()} 歩',
          secondary: '${records.length} 件 / ${calories.round()} kcal',
        );
      default:
        return const _SummaryData(primary: '—', secondary: '');
    }
  }

  String _avg(List<num> values) {
    if (values.isEmpty) return '—';
    final avg = values.reduce((a, b) => a + b) / values.length;
    return avg.toStringAsFixed(1);
  }

  Color _secondaryAccent() {
    switch (widget.kind) {
      case 'blood_pressure':
        return Colors.indigo;
      case 'blood_glucose':
        return Colors.tealAccent.shade700;
      case 'meal':
        return Colors.orangeAccent.shade700;
      case 'weight':
        return Colors.brown;
      case 'activity':
        return Colors.greenAccent.shade700;
      default:
        return widget.color;
    }
  }

  _ChartData _buildChartData(List<_MetricEntry> records) {
    return _ChartData(
      primary: _buildPrimaryTrendPoints(records),
      secondary: _buildSecondaryTrendPoints(records),
      secondaryLabel: widget.kind == 'blood_pressure' ? '平均 拡張期' : null,
    );
  }
}

class _ChartData {
  const _ChartData(
      {required this.primary,
      required this.secondary,
      required this.secondaryLabel});

  final List<_TrendPoint> primary;
  final List<_TrendPoint> secondary;
  final String? secondaryLabel;
}

class _MetricDetailSnapshot {
  const _MetricDetailSnapshot({
    required this.records,
    required this.goals,
    required this.goalAchievements,
    required this.points,
    required this.secondaryPoints,
  });

  final List<_MetricEntry> records;
  final List<Map<String, dynamic>> goals;
  final Map<String, Map<String, dynamic>> goalAchievements;
  final List<_TrendPoint> points;
  final List<_TrendPoint> secondaryPoints;
}

List<String> _goalTypesForKind(String kind) {
  switch (kind) {
    case 'activity':
      return const ['daily_step_count', 'weekly_exercise_days'];
    case 'meal':
      return const ['daily_calorie_limit'];
    case 'blood_pressure':
      return const [
        'blood_pressure_systolic_max',
        'blood_pressure_diastolic_max'
      ];
    case 'blood_glucose':
      return const [
        'blood_glucose_fasting_range',
        'blood_glucose_postprandial_range'
      ];
    case 'weight':
      return const ['weight_target'];
    default:
      return const [];
  }
}

String _goalTypeLabel(String goalType) {
  switch (goalType) {
    case 'daily_step_count':
      return '歩数';
    case 'blood_pressure_systolic_max':
      return '血圧 収縮期上限';
    case 'blood_pressure_diastolic_max':
      return '血圧 拡張期上限';
    case 'blood_glucose_fasting_range':
      return '血糖 空腹時範囲';
    case 'blood_glucose_postprandial_range':
      return '血糖 食後範囲';
    case 'daily_calorie_limit':
      return '1日トータル摂取カロリー上限';
    case 'weekly_exercise_days':
      return '週次運動日数';
    case 'weight_target':
      return '体重目標';
    default:
      return goalType;
  }
}

String _goalSummaryText(Map<String, dynamic> goal) {
  final goalType = goal['goalType'] as String? ?? '';
  final targetValue = goal['targetValue'];
  final targetMin = goal['targetMin'];
  final targetMax = goal['targetMax'];
  switch (goalType) {
    case 'daily_step_count':
      return '目標 ${targetValue ?? '—'} 歩';
    case 'blood_pressure_systolic_max':
    case 'blood_pressure_diastolic_max':
      return '上限 ${targetValue ?? '—'} mmHg';
    case 'blood_glucose_fasting_range':
    case 'blood_glucose_postprandial_range':
      return '範囲 ${targetMin ?? '—'} - ${targetMax ?? '—'} mg/dL';
    case 'daily_calorie_limit':
      return '上限 ${targetValue ?? '—'} kcal';
    case 'weekly_exercise_days':
      return '週 ${targetValue ?? '—'} 日';
    case 'weight_target':
      return '目標 ${targetValue ?? '—'} kg';
    default:
      return targetValue?.toString() ?? '—';
  }
}

String _goalTargetValueText(Map<String, dynamic> goal) {
  final goalType = goal['goalType'] as String? ?? '';
  final targetValue = goal['targetValue'];
  final targetMin = goal['targetMin'];
  final targetMax = goal['targetMax'];
  switch (goalType) {
    case 'blood_glucose_fasting_range':
    case 'blood_glucose_postprandial_range':
      return '${targetMin ?? '—'} - ${targetMax ?? '—'} mg/dL';
    case 'daily_step_count':
      return '${targetValue ?? '—'} 歩';
    case 'blood_pressure_systolic_max':
    case 'blood_pressure_diastolic_max':
      return '${targetValue ?? '—'} mmHg';
    case 'daily_calorie_limit':
      return '${targetValue ?? '—'} kcal';
    case 'weekly_exercise_days':
      return '${targetValue ?? '—'} 日';
    case 'weight_target':
      return '${targetValue ?? '—'} kg';
    default:
      return targetValue?.toString() ?? '—';
  }
}

String _goalPeriodLabel(String period) {
  switch (period) {
    case 'daily':
      return '日次';
    case 'weekly':
      return '週次';
    default:
      return period;
  }
}

String _goalDateLabel(String? value) {
  if (value == null || value.isEmpty) return '未設定';
  final parsed = DateTime.tryParse(value);
  if (parsed == null) return value;
  return DateFormat('yyyy/MM/dd').format(parsed.toLocal());
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _MetricEntry {
  _MetricEntry({
    required this.kind,
    required this.record,
    required this.recordedAt,
    required this.title,
    required this.subtitle,
    required this.trendValue,
  });

  final String kind;
  final Map<String, dynamic> record;
  final DateTime recordedAt;
  final String title;
  final String subtitle;
  final num? trendValue;

  factory _MetricEntry.fromKind(String kind, Map<String, dynamic> record) {
    final recordedAt = DateTime.parse(record['recordedAt'] as String).toLocal();
    switch (kind) {
      case 'blood_pressure':
        return _MetricEntry(
          kind: kind,
          record: record,
          recordedAt: recordedAt,
          title: '${record['systolic']} / ${record['diastolic']} mmHg',
          subtitle: '脈拍 ${record['pulse'] ?? '-'} / ${record['period'] ?? '-'}',
          trendValue: (record['systolic'] as num?)?.toDouble(),
        );
      case 'blood_glucose':
        return _MetricEntry(
          kind: kind,
          record: record,
          recordedAt: recordedAt,
          title: '${record['value']} ${record['unit']}',
          subtitle: 'タイミング: ${record['timing'] ?? '-'}',
          trendValue: (record['value'] as num?)?.toDouble(),
        );
      case 'meal':
        final items = (record['items'] as String? ?? '').trim();
        return _MetricEntry(
          kind: kind,
          record: record,
          recordedAt: recordedAt,
          title: items.isEmpty ? '食事' : items,
          subtitle:
              '${record['estimatedCalories'] != null ? '約 ${record['estimatedCalories']} kcal' : 'カロリー未設定'}${record['photoUri'] != null ? ' / 写真あり' : ''}',
          trendValue: ((record['estimatedCalories'] as num?) ?? 1).toDouble(),
        );
      case 'weight':
        return _MetricEntry(
          kind: kind,
          record: record,
          recordedAt: recordedAt,
          title: '${record['value']} kg',
          subtitle: (record['memo'] as String?) ?? '',
          trendValue: (record['value'] as num?)?.toDouble(),
        );
      case 'activity':
        final parts = <String>[];
        if (record['steps'] != null) {
          parts.add('歩数 ${record['steps']}');
        }
        if (record['activeMinutes'] != null) {
          parts.add('活動 ${record['activeMinutes']} 分');
        }
        if (record['caloriesBurned'] != null) {
          parts.add('消費 ${record['caloriesBurned']} kcal');
        }
        return _MetricEntry(
          kind: kind,
          record: record,
          recordedAt: recordedAt,
          title: parts.isEmpty ? '運動' : parts.join(' · '),
          subtitle: (record['memo'] as String?) ?? '',
          trendValue: (record['steps'] as num? ??
                  record['caloriesBurned'] as num? ??
                  record['activeMinutes'] as num?)
              ?.toDouble(),
        );
      default:
        return _MetricEntry(
          kind: kind,
          record: record,
          recordedAt: recordedAt,
          title: '-',
          subtitle: '',
          trendValue: null,
        );
    }
  }
}

class _TrendPoint {
  const _TrendPoint({required this.date, required this.value});

  final String date;
  final num? value;
}

class _SummaryData {
  const _SummaryData({required this.primary, required this.secondary});

  final String primary;
  final String secondary;
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.icon,
    required this.color,
    required this.summary,
  });

  final String title;
  final IconData icon;
  final Color color;
  final _SummaryData summary;

  @override
  Widget build(BuildContext context) {
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
              child: Icon(icon, color: color),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.labelLarge),
                  const SizedBox(height: 4),
                  Text(
                    summary.primary,
                    style: Theme.of(context)
                        .textTheme
                        .headlineSmall
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(summary.secondary),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TrendCard extends StatelessWidget {
  const _TrendCard({
    required this.title,
    required this.points,
    required this.accent,
    required this.valueLabel,
    required this.secondaryPoints,
    required this.secondaryAccent,
    required this.secondaryLabel,
  });

  final String title;
  final List<_TrendPoint> points;
  final Color accent;
  final String valueLabel;
  final List<_TrendPoint> secondaryPoints;
  final Color secondaryAccent;
  final String? secondaryLabel;

  @override
  Widget build(BuildContext context) {
    final allDates = <String>{
      ...points.map((point) => point.date),
      ...secondaryPoints.map((point) => point.date),
    }.toList()
      ..sort();
    final primaryMap = {
      for (final point in points) point.date: point.value?.toDouble()
    };
    final secondaryMap = {
      for (final point in secondaryPoints) point.date: point.value?.toDouble()
    };
    final chartPoints = allDates
        .map(
          (date) => _ChartPoint(
            label: date,
            primary: primaryMap[date],
            secondary: secondaryMap[date],
          ),
        )
        .toList();

    final allValues = <double>[
      ...chartPoints.map((point) => point.primary).whereType<double>(),
      ...chartPoints.map((point) => point.secondary).whereType<double>(),
    ];
    final maxValue = allValues.isEmpty ? 0.0 : allValues.reduce(math.max);
    final minValue = allValues.isEmpty ? 0.0 : allValues.reduce(math.min);

    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (chartPoints.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text('この期間のデータはありません。'),
              )
            else ...[
              SizedBox(
                height: 220,
                child: CustomPaint(
                  painter: _LineChartPainter(
                    points: chartPoints,
                    primaryColor: accent,
                    secondaryColor: secondaryAccent,
                    minValue: minValue,
                    maxValue: maxValue,
                  ),
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4, bottom: 8),
                    child: Column(
                      children: [
                        Expanded(child: Container()),
                        Row(
                          children: [
                            for (final point in chartPoints)
                              Expanded(
                                child: Text(
                                  DateFormat('MM/dd').format(DateTime.parse(
                                      '${point.label}T00:00:00')),
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context).textTheme.labelSmall,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  _LegendDot(color: accent, label: valueLabel),
                  if (secondaryPoints.isNotEmpty && secondaryLabel != null)
                    _LegendDot(color: secondaryAccent, label: secondaryLabel!),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '最小 ${minValue.toStringAsFixed(1)} / 最大 ${maxValue.toStringAsFixed(1)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _GoalCard extends StatelessWidget {
  const _GoalCard({
    required this.goal,
    required this.achievement,
    required this.color,
    required this.onEdit,
    required this.onDelete,
  });

  final Map<String, dynamic> goal;
  final Map<String, dynamic>? achievement;
  final Color color;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final goalType = goal['goalType'] as String? ?? '';
    final rate = (achievement?['achievementRate'] as num?)?.toDouble();
    final achieved = achievement?['achieved'] == true;
    final details = achievement?['details'] as String?;
    final currentValue = achievement?['currentValue'] as num?;
    final targetSummary = _goalSummaryText(goal);
    final periodLabel = _goalPeriodLabel(goal['period'] as String? ?? '');
    final startLabel = _goalDateLabel(goal['startsOn'] as String?);
    final endLabel = _goalDateLabel(goal['endsOn'] as String?);
    final progress = rate == null ? null : (rate / 100).clamp(0.0, 1.0);
    final statusColor = goal['isActive'] == false
        ? Colors.grey
        : achieved
            ? Colors.green
            : Colors.orange;

    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 10,
                  height: 10,
                  margin: const EdgeInsets.only(top: 5, right: 10),
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _goalTypeLabel(goalType),
                        style: Theme.of(context)
                            .textTheme
                            .titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        targetSummary,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                _GoalStatusChip(
                  label: goal['isActive'] == false
                      ? '無効'
                      : (achieved ? '達成' : '進行中'),
                  color: statusColor,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              [
                '期間 $periodLabel',
                '開始 $startLabel',
                if (goal['endsOn'] != null) '終了 $endLabel',
              ].join(' / '),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if ((goal['memo'] as String?)?.trim().isNotEmpty ?? false) ...[
              const SizedBox(height: 6),
              Text(goal['memo'] as String),
            ],
            if (achievement != null) ...[
              const SizedBox(height: 12),
              LinearProgressIndicator(value: progress),
              const SizedBox(height: 6),
              Text(
                currentValue == null
                    ? (details ?? '現在値を取得できませんでした')
                    : '現在 ${currentValue.toString()} / ${_goalTargetValueText(goal)}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (details != null && details.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(details, style: Theme.of(context).textTheme.bodySmall),
              ],
            ],
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_rounded),
                  label: const Text('編集'),
                ),
                const SizedBox(width: 8),
                TextButton.icon(
                  onPressed: onDelete,
                  icon: const Icon(Icons.delete_rounded),
                  label: const Text('削除'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _GoalStatusChip extends StatelessWidget {
  const _GoalStatusChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color),
        ),
      ),
    );
  }
}

class _ChartPoint {
  const _ChartPoint(
      {required this.label, required this.primary, required this.secondary});

  final String label;
  final double? primary;
  final double? secondary;
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(label),
      ],
    );
  }
}

class _LineChartPainter extends CustomPainter {
  _LineChartPainter({
    required this.points,
    required this.primaryColor,
    required this.secondaryColor,
    required this.minValue,
    required this.maxValue,
  });

  final List<_ChartPoint> points;
  final Color primaryColor;
  final Color secondaryColor;
  final double minValue;
  final double maxValue;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;

    final chartLeft = 12.0;
    final chartRight = size.width - 12.0;
    final chartTop = 12.0;
    final chartBottom = size.height - 38.0;
    final chartHeight = chartBottom - chartTop;
    final chartWidth = chartRight - chartLeft;

    final gridPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.08)
      ..strokeWidth = 1;
    final axisPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.12)
      ..strokeWidth = 1.2;

    for (var i = 0; i <= 4; i++) {
      final y = chartTop + (chartHeight / 4) * i;
      canvas.drawLine(Offset(chartLeft, y), Offset(chartRight, y), gridPaint);
    }

    canvas.drawLine(Offset(chartLeft, chartBottom),
        Offset(chartRight, chartBottom), axisPaint);

    _drawSeries(
      canvas,
      size,
      series: points.map((p) => p.primary).toList(),
      color: primaryColor,
      chartLeft: chartLeft,
      chartTop: chartTop,
      chartWidth: chartWidth,
      chartHeight: chartHeight,
    );
    if (points.any((point) => point.secondary != null)) {
      _drawSeries(
        canvas,
        size,
        series: points.map((p) => p.secondary).toList(),
        color: secondaryColor,
        chartLeft: chartLeft,
        chartTop: chartTop,
        chartWidth: chartWidth,
        chartHeight: chartHeight,
      );
    }
  }

  void _drawSeries(
    Canvas canvas,
    Size size, {
    required List<double?> series,
    required Color color,
    required double chartLeft,
    required double chartTop,
    required double chartWidth,
    required double chartHeight,
  }) {
    final segment = <Offset>[];
    final dots = <Offset>[];
    for (var i = 0; i < series.length; i++) {
      final value = series[i];
      if (value == null) {
        if (segment.length > 1) {
          _strokePath(canvas, segment, color);
        }
        segment.clear();
        continue;
      }
      final x = series.length == 1
          ? chartLeft + chartWidth / 2
          : chartLeft + (chartWidth * i / (series.length - 1));
      final y = chartTop + chartHeight - _valueToHeight(value, chartHeight);
      final offset = Offset(x, y);
      segment.add(offset);
      dots.add(offset);
    }
    if (segment.length > 1) {
      _strokePath(canvas, segment, color);
    }
    for (final point in dots) {
      canvas.drawCircle(
        point,
        4.5,
        Paint()..color = color,
      );
      canvas.drawCircle(
        point,
        2,
        Paint()..color = Colors.white,
      );
    }
  }

  void _strokePath(Canvas canvas, List<Offset> points, Color color) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, paint);
  }

  double _valueToHeight(double value, double chartHeight) {
    if (maxValue <= minValue) return chartHeight / 2;
    final normalized =
        ((value - minValue) / (maxValue - minValue)).clamp(0.0, 1.0);
    return 12 + (chartHeight - 24) * normalized;
  }

  @override
  bool shouldRepaint(covariant _LineChartPainter oldDelegate) {
    return oldDelegate.points != points ||
        oldDelegate.primaryColor != primaryColor ||
        oldDelegate.secondaryColor != secondaryColor ||
        oldDelegate.minValue != minValue ||
        oldDelegate.maxValue != maxValue;
  }
}
