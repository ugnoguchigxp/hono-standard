import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

import '../../core/session/app_controller.dart';
import '../../core/storage/device_identity_store.dart';

class InsightsScreen extends StatefulWidget {
  const InsightsScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  late Future<Map<String, dynamic>> _snapshot = _loadSnapshot();
  final _exportFromController = TextEditingController();
  final _exportToController = TextEditingController();
  final _syncIntervalController = TextEditingController(text: '6');
  final _deviceStore = DeviceIdentityStore();

  bool _pushEnabled = true;
  bool _syncEnabled = false;
  bool _wifiOnly = false;
  String _exportFormat = 'json';
  String? _statusMessage;

  @override
  void dispose() {
    _exportFromController.dispose();
    _exportToController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    unawaited(_primeNotificationDevice());
  }

  Future<Map<String, dynamic>> _loadSnapshot() async {
    final reminders = await widget.controller.api.getReminderSettings();
    final syncPreference = await widget.controller.api.getSyncPreference();
    final devices = await widget.controller.api.listNotificationDevices();
    _syncEnabled = syncPreference['isEnabled'] == true;
    _wifiOnly = syncPreference['wifiOnly'] == true;
    _syncIntervalController.text = (syncPreference['intervalHours'] ?? 6).toString();
    return {
      'reminders': reminders,
      'syncPreference': syncPreference,
      'devices': devices,
    };
  }

  Future<void> _primeNotificationDevice() async {
    try {
      await _registerCurrentDevice();
      if (!mounted) return;
      _reload();
      setState(() => _statusMessage = 'この端末を自動登録しました');
    } catch (_) {
      if (!mounted) return;
      setState(() => _statusMessage = 'この端末の自動登録に失敗しました');
    }
  }

  void _reload() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  Future<void> _showStatus(Future<void> Function() action, String successMessage) async {
    try {
      await action();
      if (!mounted) return;
      setState(() => _statusMessage = successMessage);
      _reload();
    } catch (error) {
      if (!mounted) return;
      setState(() => _statusMessage = error.toString());
    }
  }

  Future<void> _pickExportFrom() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 90)),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      _exportFromController.text = DateFormat('yyyy-MM-dd').format(picked);
    }
  }

  Future<void> _pickExportTo() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      _exportToController.text = DateFormat('yyyy-MM-dd').format(picked);
    }
  }

  Future<void> _pickReminderTime(String reminderType, String current) async {
    final parsed = TimeOfDay(
      hour: int.parse(current.split(':').first),
      minute: int.parse(current.split(':').last),
    );
    final picked = await showTimePicker(context: context, initialTime: parsed);
    if (picked == null) return;

    final next = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    await _showStatus(
      () async {
        await widget.controller.api.updateReminderSetting(reminderType, {
          'isEnabled': true,
          'localTime': next,
        });
      },
      '$reminderType の時刻を更新しました',
    );
  }

  String _notificationPlatform() {
    if (kIsWeb) return 'web';
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.android:
        return 'android';
      default:
        return 'web';
    }
  }

  String _notificationPlatformLabel() {
    switch (_notificationPlatform()) {
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      default:
        return 'Web';
    }
  }

  Future<void> _registerCurrentDevice() async {
    final deviceToken = await _deviceStore.readOrCreateDeviceToken();
    await widget.controller.api.registerNotificationDevice({
      'platform': _notificationPlatform(),
      'deviceToken': deviceToken,
      'pushEnabled': _pushEnabled,
    });
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: FutureBuilder<Map<String, dynamic>>(
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

          final data = snapshot.data ?? const <String, dynamic>{};
          final reminders = data['reminders'] as Map<String, dynamic>? ?? const {};
          final devices = data['devices'] as Map<String, dynamic>? ?? const {};

          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
            children: [
              _SectionCard(
                title: 'リマインド設定',
                child: Column(
                  children: [
                    for (final type in const ['blood_pressure', 'blood_glucose', 'meal', 'activity'])
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _ReminderTile(
                          label: _reminderLabel(type),
                          setting: reminders['records'] is List
                              ? (reminders['records'] as List<dynamic>).cast<Map<String, dynamic>>().firstWhere(
                                    (item) => item['reminderType'] == type,
                                    orElse: () => {
                                      'reminderType': type,
                                      'isEnabled': false,
                                      'localTime': '08:00',
                                    },
                                  )
                              : {
                                  'reminderType': type,
                                  'isEnabled': false,
                                  'localTime': '08:00',
                                },
                          onToggle: (enabled, currentTime) {
                            _showStatus(
                              () async {
                                await widget.controller.api.updateReminderSetting(type, {
                                  'isEnabled': enabled,
                                  'localTime': currentTime,
                                });
                              },
                              '${_reminderLabel(type)} を更新しました',
                            );
                          },
                          onTimeTap: () async {
                            final currentTime = reminders['records'] is List
                                ? (reminders['records'] as List<dynamic>).cast<Map<String, dynamic>>().firstWhere(
                                      (item) => item['reminderType'] == type,
                                      orElse: () => {'localTime': '08:00'},
                                    )['localTime'] as String? ??
                                    '08:00'
                                : '08:00';
                            await _pickReminderTime(type, currentTime);
                          },
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: '同期設定',
                child: Column(
                  children: [
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('バックグラウンド同期'),
                      value: _syncEnabled,
                      onChanged: (value) => setState(() => _syncEnabled = value),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Wi-Fi のみ'),
                      value: _wifiOnly,
                      onChanged: (value) => setState(() => _wifiOnly = value),
                    ),
                    TextField(
                      controller: _syncIntervalController,
                      decoration: const InputDecoration(
                        labelText: '同期間隔 (hours)',
                        border: OutlineInputBorder(),
                      ),
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => _showStatus(
                        () async {
                          await widget.controller.api.updateSyncPreference({
                            'isEnabled': _syncEnabled,
                            'intervalHours': int.tryParse(_syncIntervalController.text) ?? 6,
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
              const SizedBox(height: 16),
              _SectionCard(
                title: '通知設定',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'この端末はアプリが自動判定して登録します。Device Token は内部管理用です。',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 12),
                    _InfoRow(
                      label: '現在の端末',
                      value: _notificationPlatformLabel(),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Push 有効'),
                      value: _pushEnabled,
                      onChanged: (value) {
                        setState(() => _pushEnabled = value);
                        _showStatus(
                          () async {
                            await _registerCurrentDevice();
                          },
                          '通知設定を更新しました',
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                    FilledButton.tonal(
                      onPressed: () => _showStatus(
                        () async {
                          await _registerCurrentDevice();
                        },
                        'この端末を更新しました',
                      ),
                      child: const Text('この端末を更新'),
                    ),
                    const SizedBox(height: 12),
                    Text('登録端末数: ${(devices['records'] as List<dynamic>? ?? const []).length}'),
                    const SizedBox(height: 8),
                    ...((devices['records'] as List<dynamic>? ?? const [])
                        .cast<Map<String, dynamic>>()
                        .map(
                          (device) => ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.phone_iphone_rounded),
                            title: Text(
                              '${_platformLabel(device['platform'] as String? ?? '-')}${device['pushEnabled'] == true ? ' / Push 有効' : ' / Push 無効'}',
                            ),
                            subtitle: Text(
                              '最終更新 ${device['lastSeenAt'] as String? ?? '-'}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: 'データ出力',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _pickExportFrom,
                            child: Text(_exportFromController.text.isEmpty
                                ? '開始日'
                                : _exportFromController.text),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _pickExportTo,
                            child: Text(_exportToController.text.isEmpty
                                ? '終了日'
                                : _exportToController.text),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      initialValue: _exportFormat,
                      decoration: const InputDecoration(
                        labelText: '形式',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'json', child: Text('JSON')),
                        DropdownMenuItem(value: 'csv', child: Text('CSV')),
                      ],
                      onChanged: (value) => setState(() => _exportFormat = value ?? 'json'),
                    ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: () => _showStatus(
                        () async {
                          final exported = await widget.controller.api.exportHealthData(
                            format: _exportFormat,
                            from: _exportFromController.text.trim().isEmpty
                                ? null
                                : _exportFromController.text.trim(),
                            to: _exportToController.text.trim().isEmpty
                                ? null
                                : _exportToController.text.trim(),
                          );
                          setState(() {
                            _statusMessage =
                                'exported ${exported['records'] != null ? 'records' : 'data'}';
                          });
                        },
                        'エクスポートを実行しました',
                      ),
                      child: const Text('エクスポート'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: 'アカウント',
                child: FilledButton.tonalIcon(
                  onPressed: () async => widget.controller.logout(),
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('ログアウト'),
                ),
              ),
              if (_statusMessage != null) ...[
                const SizedBox(height: 16),
                Text(_statusMessage!, style: TextStyle(color: Theme.of(context).colorScheme.primary)),
              ],
            ],
          );
        },
      ),
    );
  }

  String _reminderLabel(String type) {
    switch (type) {
      case 'blood_pressure':
        return '血圧';
      case 'blood_glucose':
        return '血糖';
      case 'meal':
        return '食事';
      case 'activity':
        return '運動';
      default:
        return type;
    }
  }

  String _platformLabel(String platform) {
    switch (platform) {
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      case 'web':
        return 'Web';
      default:
        return platform;
    }
  }
}

class _ReminderTile extends StatelessWidget {
  const _ReminderTile({
    required this.label,
    required this.setting,
    required this.onToggle,
    required this.onTimeTap,
  });

  final String label;
  final Map<String, dynamic> setting;
  final void Function(bool enabled, String currentTime) onToggle;
  final VoidCallback onTimeTap;

  @override
  Widget build(BuildContext context) {
    final enabled = setting['isEnabled'] == true;
    final currentTime = setting['localTime'] as String? ?? '08:00';
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(currentTime),
                      const SizedBox(width: 8),
                      TextButton(onPressed: onTimeTap, child: const Text('時刻変更')),
                    ],
                  ),
                ],
              ),
            ),
            Switch(
              value: enabled,
              onChanged: (value) => onToggle(value, currentTime),
            ),
          ],
        ),
      ),
    );
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        Text(value),
      ],
    );
  }
}
