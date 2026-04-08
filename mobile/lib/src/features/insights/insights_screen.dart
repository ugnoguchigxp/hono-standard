import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:fquery/fquery.dart';
import 'package:fquery_core/fquery_core.dart';
import 'package:intl/intl.dart';

import '../../core/query/app_query.dart';
import '../../core/query/health_query_keys.dart';
import '../../core/session/app_controller.dart';
import '../../core/storage/device_identity_store.dart';

class InsightsScreen extends StatefulWidget {
  const InsightsScreen({super.key, required this.controller});

  final AppController controller;

  @override
  State<InsightsScreen> createState() => _InsightsScreenState();
}

class _InsightsScreenState extends State<InsightsScreen> {
  final _exportFromController = TextEditingController();
  final _exportToController = TextEditingController();
  final _syncIntervalController = TextEditingController(text: '6');
  final _ageController = TextEditingController();
  final _heightCmController = TextEditingController();
  final _deviceStore = DeviceIdentityStore();

  bool _pushEnabled = true;
  bool _syncEnabled = false;
  bool _wifiOnly = false;
  String _exportFormat = 'json';
  String? _selectedGender;
  String? _selectedActivityLevel;
  String? _statusMessage;

  @override
  void dispose() {
    _exportFromController.dispose();
    _exportToController.dispose();
    _syncIntervalController.dispose();
    _ageController.dispose();
    _heightCmController.dispose();
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
    final profile = await widget.controller.api.getHealthProfile();
    final goals = await widget.controller.api.getHealthGoals();
    _syncEnabled = syncPreference['isEnabled'] == true;
    _wifiOnly = syncPreference['wifiOnly'] == true;
    _syncIntervalController.text =
        (syncPreference['intervalHours'] ?? 6).toString();
    _ageController.text = profile['age']?.toString() ?? '';
    _heightCmController.text = profile['heightCm']?.toString() ?? '';
    final gender = profile['gender'] as String?;
    _selectedGender = (gender == 'male' || gender == 'female') ? gender : null;
    final activityLevel = profile['activityLevel'] as String?;
    _selectedActivityLevel =
        _isActivityLevel(activityLevel) ? activityLevel : null;
    return {
      'reminders': reminders,
      'syncPreference': syncPreference,
      'devices': devices,
      'profile': profile,
      'goals': goals,
    };
  }

  Future<void> _primeNotificationDevice() async {
    try {
      await _registerCurrentDevice();
      if (!mounted) return;
      invalidateHealthQueries(context);
      setState(() => _statusMessage = 'この端末を自動登録しました');
    } catch (_) {
      if (!mounted) return;
      setState(() => _statusMessage = 'この端末の自動登録に失敗しました');
    }
  }

  Future<void> _showStatus(
      Future<void> Function() action, String successMessage) async {
    try {
      await action();
      if (!mounted) return;
      setState(() => _statusMessage = successMessage);
      invalidateHealthQueries(context);
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

    final next =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
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

  Future<void> _saveHealthProfile() async {
    final ageText = _ageController.text.trim();
    final heightText = _heightCmController.text.trim();
    final age = ageText.isEmpty ? null : int.tryParse(ageText);
    final heightCm = heightText.isEmpty ? null : num.tryParse(heightText);

    if (ageText.isNotEmpty && age == null) {
      throw StateError('年齢は数値で入力してください');
    }
    if (age != null && (age < 1 || age > 120)) {
      throw StateError('年齢は 1 から 120 の範囲で入力してください');
    }
    if (heightText.isNotEmpty && heightCm == null) {
      throw StateError('身長は数値で入力してください');
    }
    if (heightCm != null && (heightCm <= 0 || heightCm > 300)) {
      throw StateError('身長は 0 より大きく 300 以下で入力してください');
    }

    await widget.controller.api.updateHealthProfile({
      'age': age,
      'gender': _selectedGender,
      'heightCm': heightCm?.toDouble(),
      'activityLevel': _selectedActivityLevel,
    });
  }

  Future<void> _applyRecommendedMealGoal(int recommendedCalories) async {
    final goals = await widget.controller.api.getHealthGoals();
    final records = widget.controller.api.listRecords(goals, 'records');
    Map<String, dynamic>? existingMealGoal;
    for (final goal in records) {
      if (goal['goalType'] == 'daily_calorie_limit') {
        existingMealGoal = goal;
        break;
      }
    }

    if (existingMealGoal != null) {
      await widget.controller.api
          .updateHealthGoal(existingMealGoal['id'] as String, {
        'targetValue': recommendedCalories,
        'isActive': true,
        'memo': 'TDEE推奨値から設定',
      });
      return;
    }

    await widget.controller.api.createHealthGoal({
      'goalType': 'daily_calorie_limit',
      'period': 'daily',
      'targetValue': recommendedCalories,
      'startsOn': DateFormat('yyyy-MM-dd').format(DateTime.now()),
      'isActive': true,
      'memo': 'TDEE推奨値から設定',
    });
  }

  @override
  Widget build(BuildContext context) {
    return QueryBuilder<Map<String, dynamic>, DioException>(
      options: QueryOptions<Map<String, dynamic>, DioException>(
        queryKey: healthInsightsQuery(),
        queryFn: _loadSnapshot,
      ),
      builder: (context, result) {
        return RefreshIndicator(
          onRefresh: () async => result.refetch(),
          child: _buildBody(context, result),
        );
      },
    );
  }

  Widget _buildBody(
    BuildContext context,
    QueryResult<Map<String, dynamic>, DioException> result,
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

    final data = result.data ?? const <String, dynamic>{};
    final reminders = data['reminders'] as Map<String, dynamic>? ?? const {};
    final devices = data['devices'] as Map<String, dynamic>? ?? const {};
    final profile = data['profile'] as Map<String, dynamic>? ?? const {};
    final latestWeightKg = (profile['latestWeightKg'] as num?)?.toDouble();
    final ageValue = int.tryParse(_ageController.text.trim());
    final heightCmValue = double.tryParse(_heightCmController.text.trim());
    final bmr = _calculateBmr(
      weightKg: latestWeightKg,
      heightCm: heightCmValue,
      age: ageValue,
      gender: _selectedGender,
    );
    final tdee = _calculateTdee(
      weightKg: latestWeightKg,
      heightCm: heightCmValue,
      age: ageValue,
      gender: _selectedGender,
      activityLevel: _selectedActivityLevel,
    );

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      children: [
        _SectionCard(
          title: 'リマインド設定',
          child: Column(
            children: [
              for (final type in const [
                'blood_pressure',
                'blood_glucose',
                'meal',
                'activity'
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ReminderTile(
                    label: _reminderLabel(type),
                    setting: reminders['records'] is List
                        ? (reminders['records'] as List<dynamic>)
                            .cast<Map<String, dynamic>>()
                            .firstWhere(
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
                          await widget.controller.api
                              .updateReminderSetting(type, {
                            'isEnabled': enabled,
                            'localTime': currentTime,
                          });
                        },
                        '${_reminderLabel(type)} を更新しました',
                      );
                    },
                    onTimeTap: () async {
                      final currentTime = reminders['records'] is List
                          ? (reminders['records'] as List<dynamic>)
                                  .cast<Map<String, dynamic>>()
                                  .firstWhere(
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
          title: '身体プロフィール・食事目標',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      key: const Key('profile_age'),
                      controller: _ageController,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        labelText: '年齢',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      key: const Key('profile_gender'),
                      initialValue: _selectedGender,
                      decoration: const InputDecoration(
                        labelText: '性別',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'male',
                          child: Text('男性'),
                        ),
                        DropdownMenuItem(
                          value: 'female',
                          child: Text('女性'),
                        ),
                      ],
                      onChanged: (value) =>
                          setState(() => _selectedGender = value),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      key: const Key('profile_height'),
                      controller: _heightCmController,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        labelText: '身長 (cm)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      key: const Key('profile_activity_level'),
                      initialValue: _selectedActivityLevel,
                      decoration: const InputDecoration(
                        labelText: '活動レベル',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: 'sedentary',
                          child: Text('ほぼ運動なし'),
                        ),
                        DropdownMenuItem(
                          value: 'light',
                          child: Text('軽い運動'),
                        ),
                        DropdownMenuItem(
                          value: 'moderate',
                          child: Text('中程度'),
                        ),
                        DropdownMenuItem(
                          value: 'active',
                          child: Text('活発'),
                        ),
                        DropdownMenuItem(
                          value: 'very_active',
                          child: Text('非常に活発'),
                        ),
                      ],
                      onChanged: (value) =>
                          setState(() => _selectedActivityLevel = value),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _InfoRow(
                label: '最新体重',
                value: latestWeightKg != null
                    ? '${latestWeightKg.toStringAsFixed(1)} kg'
                    : '未記録',
              ),
              const SizedBox(height: 8),
              _InfoRow(
                label: '基礎代謝 (BMR)',
                value: bmr != null ? '$bmr kcal/日' : '算出不可',
              ),
              const SizedBox(height: 8),
              _InfoRow(
                label: '総消費カロリー (TDEE)',
                value: tdee != null ? '$tdee kcal/日' : '算出不可',
              ),
              const SizedBox(height: 12),
              FilledButton(
                key: const Key('profile_save_button'),
                onPressed: () => _showStatus(
                  _saveHealthProfile,
                  '身体プロフィールを更新しました',
                ),
                child: const Text('プロフィールを保存'),
              ),
              const SizedBox(height: 8),
              FilledButton.tonal(
                key: const Key('meal_goal_reflect_button'),
                onPressed: tdee == null
                    ? null
                    : () => _showStatus(
                          () => _applyRecommendedMealGoal(tdee),
                          '食事目標を TDEE ベースに更新しました',
                        ),
                child: const Text('食事目標に反映 (TDEE ベース)'),
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
                      'intervalHours':
                          int.tryParse(_syncIntervalController.text) ?? 6,
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
              Text(
                  '登録端末数: ${(devices['records'] as List<dynamic>? ?? const []).length}'),
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
                onChanged: (value) =>
                    setState(() => _exportFormat = value ?? 'json'),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => _showStatus(
                  () async {
                    final exported =
                        await widget.controller.api.exportHealthData(
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
          Text(
            _statusMessage!,
            style: TextStyle(color: Theme.of(context).colorScheme.primary),
          ),
        ],
      ],
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

  bool _isActivityLevel(String? value) {
    switch (value) {
      case 'sedentary':
      case 'light':
      case 'moderate':
      case 'active':
      case 'very_active':
        return true;
      default:
        return false;
    }
  }
}

int? _calculateBmr({
  required double? weightKg,
  required double? heightCm,
  required int? age,
  required String? gender,
}) {
  if (weightKg == null || heightCm == null || age == null) return null;
  if (gender != 'male' && gender != 'female') return null;
  final s = gender == 'male' ? 5 : -161;
  final bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;
  return bmr.round();
}

const _activityMultiplier = <String, double>{
  'sedentary': 1.2,
  'light': 1.375,
  'moderate': 1.55,
  'active': 1.725,
  'very_active': 1.9,
};

int? _calculateTdee({
  required double? weightKg,
  required double? heightCm,
  required int? age,
  required String? gender,
  required String? activityLevel,
}) {
  final bmr = _calculateBmr(
    weightKg: weightKg,
    heightCm: heightCm,
    age: age,
    gender: gender,
  );
  final multiplier =
      activityLevel == null ? null : _activityMultiplier[activityLevel];
  if (bmr == null || multiplier == null) return null;
  return (bmr * multiplier).round();
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
                      TextButton(
                          onPressed: onTimeTap, child: const Text('時刻変更')),
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
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(fontWeight: FontWeight.w600),
          ),
        ),
        Text(value),
      ],
    );
  }
}
