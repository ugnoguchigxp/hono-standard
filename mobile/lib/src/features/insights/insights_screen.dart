import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/api/health_api.dart';

class InsightsScreen extends StatefulWidget {
  const InsightsScreen({super.key});

  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  final HealthApi _api = HealthApi.create();
  final TextEditingController _deviceTokenController = TextEditingController();
  final TextEditingController _reminderTimeController = TextEditingController(text: '08:00');
  final TextEditingController _exportFromController = TextEditingController();
  final TextEditingController _exportToController = TextEditingController();

  Future<Map<String, dynamic>>? _snapshot;
  bool _pushEnabled = true;
  bool _syncEnabled = false;
  bool _wifiOnly = false;
  String _exportFormat = 'json';
  String _notificationPlatform = 'android';
  String _reminderType = 'blood_pressure';
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void dispose() {
    _deviceTokenController.dispose();
    _reminderTimeController.dispose();
    _exportFromController.dispose();
    _exportToController.dispose();
    super.dispose();
  }

  void _reload() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  Future<Map<String, dynamic>> _loadSnapshot() async {
    final summary = await _api.getDailySummary();
    final alerts = await _api.getAlerts(limit: 3);
    final report = await _api.getWeeklyReport();
    final reminders = await _api.getReminderSettings();
    final syncPreference = await _api.getSyncPreference();
    final devices = await _api.listNotificationDevices();
    _syncEnabled = syncPreference['isEnabled'] == true;
    _wifiOnly = syncPreference['wifiOnly'] == true;
    return {
      'summary': summary,
      'alerts': alerts,
      'report': report,
      'reminders': reminders,
      'syncPreference': syncPreference,
      'devices': devices,
    };
  }

  Future<void> _showStatus(Future<void> Function() action, String successMessage) async {
    try {
      await action();
      if (!mounted) return;
      setState(() => _statusMessage = successMessage);
      _reload();
    } catch (e) {
      if (!mounted) return;
      setState(() => _statusMessage = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('予防ケア')),
      body: RefreshIndicator(
        onRefresh: () async => _reload(),
        child: FutureBuilder<Map<String, dynamic>>(
          future: _snapshot,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return ListView(
                padding: const EdgeInsets.all(16),
                children: [Text('読み込み失敗: ${snapshot.error}')],
              );
            }
            final data = snapshot.data ?? <String, dynamic>{};
            final summary = (data['summary'] as Map<String, dynamic>? ?? {});
            final alerts = (data['alerts'] as Map<String, dynamic>? ?? {});
            final report = (data['report'] as Map<String, dynamic>? ?? {});
            final reminders = (data['reminders'] as Map<String, dynamic>? ?? {});
            final devices = (data['devices'] as Map<String, dynamic>? ?? {});

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _SectionCard(
                  title: '今日のサマリ',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('歩数 ${summary['stepsTotal'] ?? '-'}'),
                      Text('活動 kcal ${summary['activityCaloriesTotal'] ?? '-'}'),
                      Text('食事 ${summary['mealCount'] ?? '-'} 件'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  title: '未読アラート',
                  child: _AlertList(records: alerts['records'] as List<dynamic>? ?? const []),
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  title: '週次レポート',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${report['report']?['weekStart'] ?? '-'} 〜 ${report['report']?['weekEnd'] ?? '-'}'),
                      const SizedBox(height: 8),
                      Text('歩数合計: ${report['report']?['stepsTotal'] ?? '-'}'),
                      Text('目標達成率: ${_percent(report['report']?['goalAchievementRateAverage'])}'),
                      if ((report['report']?['summary'] as String?)?.isNotEmpty ?? false)
                        Text(report['report']?['summary'] as String),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  title: '通知端末登録',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _notificationPlatform,
                        items: const [
                          DropdownMenuItem(value: 'android', child: Text('Android')),
                          DropdownMenuItem(value: 'ios', child: Text('iOS')),
                          DropdownMenuItem(value: 'web', child: Text('Web')),
                        ],
                        onChanged: (v) => setState(() => _notificationPlatform = v ?? 'android'),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _deviceTokenController,
                        decoration: const InputDecoration(
                          labelText: 'Device Token',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Push 有効'),
                        value: _pushEnabled,
                        onChanged: (v) => setState(() => _pushEnabled = v),
                      ),
                      FilledButton(
                        onPressed: _deviceTokenController.text.trim().isEmpty
                            ? null
                            : () => _showStatus(
                                  () async {
                                    await _api.registerNotificationDevice({
                                      'platform': _notificationPlatform,
                                      'deviceToken': _deviceTokenController.text.trim(),
                                      'pushEnabled': _pushEnabled,
                                    });
                                  },
                                  '通知端末を登録しました',
                                ),
                        child: const Text('登録'),
                      ),
                      const SizedBox(height: 8),
                      Text('登録端末数: ${(devices['records'] as List<dynamic>? ?? const []).length}'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  title: 'リマインド設定',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _reminderType,
                        items: const [
                          DropdownMenuItem(value: 'blood_pressure', child: Text('血圧')),
                          DropdownMenuItem(value: 'blood_glucose', child: Text('血糖')),
                          DropdownMenuItem(value: 'meal', child: Text('食事')),
                          DropdownMenuItem(value: 'activity', child: Text('運動')),
                        ],
                        onChanged: (v) => setState(() => _reminderType = v ?? 'blood_pressure'),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _reminderTimeController,
                        decoration: const InputDecoration(
                          labelText: '時刻 HH:mm',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: () => _showStatus(
                          () async {
                            await _api.updateReminderSetting(_reminderType, {
                              'isEnabled': true,
                              'localTime': _reminderTimeController.text.trim(),
                              'daysOfWeek': ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                            });
                          },
                          'リマインド設定を更新しました',
                        ),
                        child: const Text('更新'),
                      ),
                      const SizedBox(height: 8),
                      Text('設定件数: ${(reminders['records'] as List<dynamic>? ?? const []).length}'),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  title: '同期設定',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('バックグラウンド同期'),
                        value: _syncEnabled,
                        onChanged: (v) => setState(() => _syncEnabled = v),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Wi-Fi のみ'),
                        value: _wifiOnly,
                        onChanged: (v) => setState(() => _wifiOnly = v),
                      ),
                      FilledButton(
                        onPressed: () => _showStatus(
                          () async {
                            await _api.updateSyncPreference({
                              'isEnabled': _syncEnabled,
                              'intervalHours': 6,
                              'wifiOnly': _wifiOnly,
                            });
                          },
                          '同期設定を更新しました',
                        ),
                        child: const Text('保存'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _SectionCard(
                  title: 'データ出力',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _exportFormat,
                        items: const [
                          DropdownMenuItem(value: 'json', child: Text('JSON')),
                          DropdownMenuItem(value: 'csv', child: Text('CSV')),
                        ],
                        onChanged: (v) => setState(() => _exportFormat = v ?? 'json'),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _exportFromController,
                        decoration: const InputDecoration(
                          labelText: '開始日 YYYY-MM-DD',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _exportToController,
                        decoration: const InputDecoration(
                          labelText: '終了日 YYYY-MM-DD',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: () => _showStatus(
                          () async {
                            await _api.exportHealthData(
                              format: _exportFormat,
                              from: _exportFromController.text.trim().isEmpty ? null : _exportFromController.text.trim(),
                              to: _exportToController.text.trim().isEmpty ? null : _exportToController.text.trim(),
                            );
                          },
                          'エクスポートを実行しました',
                        ),
                        child: const Text('エクスポート'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if (_statusMessage != null)
                  Text(
                    _statusMessage!,
                    style: TextStyle(color: Theme.of(context).colorScheme.primary),
                  ),
                const SizedBox(height: 12),
                Text(
                  '更新時刻 ${DateFormat.Hm().format(DateTime.now())}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  String _percent(dynamic value) {
    if (value is num) return '${value.round()}%';
    return '—';
  }
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

class _AlertList extends StatelessWidget {
  const _AlertList({required this.records});

  final List<dynamic> records;

  @override
  Widget build(BuildContext context) {
    if (records.isEmpty) {
      return const Text('未読アラートはありません。');
    }
    return Column(
      children: records.map((record) {
        final map = record as Map<String, dynamic>;
        return ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(map['title'] as String? ?? '-'),
          subtitle: Text(map['message'] as String? ?? '-'),
          trailing: Text(map['severity'] as String? ?? '-'),
        );
      }).toList(),
    );
  }
}
