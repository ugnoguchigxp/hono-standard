import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/session/app_controller.dart';
import '../records/record_editor_sheet.dart';

class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  late DateTime _from = DateTime.now().subtract(const Duration(days: 30));
  late DateTime _to = DateTime.now();
  String _filter = 'all';
  Future<List<_TimelineRow>>? _snapshot;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    setState(() {
      _snapshot = _loadRows();
    });
  }

  Future<List<_TimelineRow>> _loadRows() async {
    final from = DateFormat('yyyy-MM-dd').format(_from);
    final to = DateFormat('yyyy-MM-dd').format(_to);

    final results = await Future.wait([
      widget.controller.api.listBloodPressure(from: from, to: to),
      widget.controller.api.listBloodGlucose(from: from, to: to),
      widget.controller.api.listMeals(from: from, to: to),
      widget.controller.api.listWeight(from: from, to: to),
      widget.controller.api.getActivityRecords(from: from, to: to),
    ]);

    final rows = <_TimelineRow>[];
    rows.addAll(_mapBloodPressure(results[0]));
    rows.addAll(_mapBloodGlucose(results[1]));
    rows.addAll(_mapMeals(results[2]));
    rows.addAll(_mapWeight(results[3]));
    rows.addAll(_mapActivity(results[4]));
    rows.sort((a, b) => b.recordedAt.compareTo(a.recordedAt));
    return rows;
  }

  List<_TimelineRow> _mapBloodPressure(Map<String, dynamic> response) {
    return (response['records'] as List<dynamic>? ?? const []).map((record) {
      final map = Map<String, dynamic>.from(record as Map<String, dynamic>)..['kind'] = 'blood_pressure';
      return _TimelineRow(
        kind: 'blood_pressure',
        record: map,
        recordedAt: DateTime.parse(map['recordedAt'] as String),
        title: '${map['systolic']} / ${map['diastolic']} mmHg',
        subtitle: '期間: ${map['period'] ?? '-'}',
      );
    }).toList();
  }

  List<_TimelineRow> _mapBloodGlucose(Map<String, dynamic> response) {
    return (response['records'] as List<dynamic>? ?? const []).map((record) {
      final map = Map<String, dynamic>.from(record as Map<String, dynamic>)..['kind'] = 'blood_glucose';
      return _TimelineRow(
        kind: 'blood_glucose',
        record: map,
        recordedAt: DateTime.parse(map['recordedAt'] as String),
        title: '${map['value']} ${map['unit']}',
        subtitle: 'タイミング: ${map['timing'] ?? '-'}',
      );
    }).toList();
  }

  List<_TimelineRow> _mapMeals(Map<String, dynamic> response) {
    return (response['records'] as List<dynamic>? ?? const []).map((record) {
      final map = Map<String, dynamic>.from(record as Map<String, dynamic>)..['kind'] = 'meal';
      final items = (map['items'] as String? ?? '').trim();
      return _TimelineRow(
        kind: 'meal',
        record: map,
        recordedAt: DateTime.parse(map['recordedAt'] as String),
        title: items.isEmpty ? '食事' : items,
        subtitle: map['estimatedCalories'] != null ? '約 ${map['estimatedCalories']} kcal' : 'カロリー未設定',
      );
    }).toList();
  }

  List<_TimelineRow> _mapWeight(Map<String, dynamic> response) {
    return (response['records'] as List<dynamic>? ?? const []).map((record) {
      final map = Map<String, dynamic>.from(record as Map<String, dynamic>)..['kind'] = 'weight';
      return _TimelineRow(
        kind: 'weight',
        record: map,
        recordedAt: DateTime.parse(map['recordedAt'] as String),
        title: '${map['value']} kg',
        subtitle: (map['memo'] as String?) ?? '',
      );
    }).toList();
  }

  List<_TimelineRow> _mapActivity(Map<String, dynamic> response) {
    return (response['records'] as List<dynamic>? ?? const []).map((record) {
      final map = Map<String, dynamic>.from(record as Map<String, dynamic>)..['kind'] = 'activity';
      final parts = <String>[];
      if (map['steps'] != null) parts.add('歩数 ${map['steps']}');
      if (map['activeMinutes'] != null) parts.add('活動 ${map['activeMinutes']} 分');
      if (map['caloriesBurned'] != null) parts.add('消費 ${map['caloriesBurned']} kcal');
      return _TimelineRow(
        kind: 'activity',
        record: map,
        recordedAt: DateTime.parse(map['recordedAt'] as String),
        title: parts.isEmpty ? '運動' : parts.join(' · '),
        subtitle: (map['memo'] as String?) ?? '',
      );
    }).toList();
  }

  String _kindLabel(String kind) {
    switch (kind) {
      case 'blood_pressure':
        return '血圧';
      case 'blood_glucose':
        return '血糖';
      case 'meal':
        return '食事';
      case 'weight':
        return '体重';
      case 'activity':
        return '運動';
      default:
        return kind;
    }
  }

  Future<void> _pickFromDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _from,
      firstDate: DateTime(2020),
      lastDate: _to,
    );
    if (picked != null) {
      setState(() => _from = picked);
      _reload();
    }
  }

  Future<void> _pickToDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _to,
      firstDate: _from,
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _to = picked);
      _reload();
    }
  }

  Future<void> _createRecord() async {
    final kind = _filter == 'all' || _filter == 'activity' ? 'weight' : _filter;
    final saved = await showRecordEditorSheet(
      context,
      controller: widget.controller,
      initialKind: kind,
    );
    if (saved) _reload();
  }

  Future<void> _editRecord(_TimelineRow row) async {
    if (row.kind == 'activity') return;
    final saved = await showRecordEditorSheet(
      context,
      controller: widget.controller,
      record: row.record,
      initialKind: row.kind,
    );
    if (saved) _reload();
  }

  Future<void> _deleteRecord(_TimelineRow row) async {
    final shouldDelete = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('削除しますか'),
            content: Text('${_kindLabel(row.kind)} の記録を削除します。'),
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
      if (row.kind == 'blood_pressure') {
        await api.deleteBloodPressure(row.record['id'] as String);
      } else if (row.kind == 'blood_glucose') {
        await api.deleteBloodGlucose(row.record['id'] as String);
      } else if (row.kind == 'meal') {
        await api.deleteMeal(row.record['id'] as String);
      } else if (row.kind == 'weight') {
        await api.deleteWeight(row.record['id'] as String);
      }
      _reload();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('削除に失敗しました: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: FutureBuilder<List<_TimelineRow>>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return ListView(
              padding: const EdgeInsets.all(20),
              children: [Text('読み込み失敗: ${snapshot.error}')],
            );
          }

          final rows = snapshot.data ?? const <_TimelineRow>[];
          final filtered = _filter == 'all'
              ? rows
              : rows.where((row) => row.kind == _filter).toList();

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '履歴',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: _createRecord,
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('新規入力'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                '血圧・血糖・食事・体重・運動を日付順に表示します。',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final entry in const [
                    'all',
                    'blood_pressure',
                    'blood_glucose',
                    'meal',
                    'weight',
                    'activity',
                  ])
                    FilterChip(
                      selected: _filter == entry,
                      label: Text(entry == 'all' ? 'すべて' : _kindLabel(entry)),
                      onSelected: (_) => setState(() => _filter = entry),
                    ),
                ],
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
              if (filtered.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 60),
                  child: Center(child: Text('この条件の記録はありません。')),
                )
              else
                ...filtered.map(
                  (row) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      elevation: 0,
                      child: ListTile(
                        onTap: () => _editRecord(row),
                        leading: CircleAvatar(
                          child: Text(_kindLabel(row.kind).substring(0, 1)),
                        ),
                        title: Text(row.title),
                        subtitle: Text(
                          '${DateFormat('yyyy/MM/dd HH:mm').format(row.recordedAt)}\n${row.subtitle}',
                        ),
                        isThreeLine: row.subtitle.isNotEmpty,
                        trailing: row.kind == 'activity'
                            ? const Icon(Icons.north_east_rounded)
                            : Wrap(
                                spacing: 4,
                                children: [
                                  IconButton(
                                    onPressed: () => _editRecord(row),
                                    icon: const Icon(Icons.edit_rounded),
                                  ),
                                  IconButton(
                                    onPressed: () => _deleteRecord(row),
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
        },
      ),
    );
  }
}

class _TimelineRow {
  _TimelineRow({
    required this.kind,
    required this.record,
    required this.recordedAt,
    required this.title,
    required this.subtitle,
  });

  final String kind;
  final Map<String, dynamic> record;
  final DateTime recordedAt;
  final String title;
  final String subtitle;
}
