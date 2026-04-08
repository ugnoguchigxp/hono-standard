import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/constants.dart';
import '../../core/session/app_controller.dart';

Future<bool> showRecordEditorSheet(
  BuildContext context, {
  required AppController controller,
  String initialKind = 'weight',
  Map<String, dynamic>? record,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => RecordEditorSheet(
      controller: controller,
      initialKind: initialKind,
      record: record,
    ),
  ).then((value) => value ?? false);
}

class RecordEditorSheet extends StatefulWidget {
  const RecordEditorSheet({
    super.key,
    required this.controller,
    required this.initialKind,
    this.record,
  });

  final AppController controller;
  final String initialKind;
  final Map<String, dynamic>? record;

  @override
  State<RecordEditorSheet> createState() => _RecordEditorSheetState();
}

class _RecordEditorSheetState extends State<RecordEditorSheet> {
  final _formKey = GlobalKey<FormState>();
  late String _kind;
  late final TextEditingController _recordedAtController;
  late final TextEditingController _memoController;
  late final TextEditingController _systolicController;
  late final TextEditingController _diastolicController;
  late final TextEditingController _pulseController;
  late final TextEditingController _glucoseValueController;
  late final TextEditingController _mealItemsController;
  late final TextEditingController _mealCaloriesController;
  late final TextEditingController _weightController;
  late final TextEditingController _activityStepsController;
  late final TextEditingController _activityMinutesController;
  late final TextEditingController _activityCaloriesController;
  Map<String, dynamic>? _profile;
  final _imagePicker = ImagePicker();
  bool _saving = false;
  String _bpPeriod = 'morning';
  String _glucoseUnit = 'mg_dl';
  String _glucoseTiming = 'fasting';
  String? _mealPhotoPath;

  @override
  void initState() {
    super.initState();
    _kind = widget.record?['kind'] as String? ?? widget.initialKind;
    final initial = widget.record != null
        ? DateTime.parse(widget.record!['recordedAt'] as String).toLocal()
        : DateTime.now();
    _recordedAtController = TextEditingController(
      text: DateFormat("yyyy-MM-dd'T'HH:mm").format(initial),
    );
    _memoController =
        TextEditingController(text: widget.record?['memo'] as String? ?? '');
    _systolicController = TextEditingController(
      text: widget.record?['systolic']?.toString() ?? '',
    );
    _diastolicController = TextEditingController(
      text: widget.record?['diastolic']?.toString() ?? '',
    );
    _pulseController = TextEditingController(
      text: widget.record?['pulse']?.toString() ?? '',
    );
    _glucoseValueController = TextEditingController(
      text: widget.record?['value']?.toString() ?? '',
    );
    _mealItemsController =
        TextEditingController(text: widget.record?['items'] as String? ?? '');
    _mealCaloriesController = TextEditingController(
      text: widget.record?['estimatedCalories']?.toString() ?? '',
    );
    _weightController =
        TextEditingController(text: widget.record?['value']?.toString() ?? '');
    _activityStepsController =
        TextEditingController(text: widget.record?['steps']?.toString() ?? '');
    _activityMinutesController = TextEditingController(
      text: widget.record?['activeMinutes']?.toString() ?? '',
    );
    _activityCaloriesController = TextEditingController(
      text: widget.record?['caloriesBurned']?.toString() ?? '',
    );
    _bpPeriod = widget.record?['period'] as String? ?? 'morning';
    _glucoseUnit = widget.record?['unit'] as String? ?? 'mg_dl';
    _glucoseTiming = widget.record?['timing'] as String? ?? 'fasting';
    _mealPhotoPath = widget.record?['photoUri'] as String?;
    unawaited(_loadProfile());
  }

  Future<void> _loadProfile() async {
    try {
      final profile = await widget.controller.api.getHealthProfile();
      if (!mounted) return;
      setState(() => _profile = profile);
    } catch (_) {
      // Ignore profile load failures; the editor still works without it.
    }
  }

  @override
  void dispose() {
    _recordedAtController.dispose();
    _memoController.dispose();
    _systolicController.dispose();
    _diastolicController.dispose();
    _pulseController.dispose();
    _glucoseValueController.dispose();
    _mealItemsController.dispose();
    _mealCaloriesController.dispose();
    _weightController.dispose();
    _activityStepsController.dispose();
    _activityMinutesController.dispose();
    _activityCaloriesController.dispose();
    super.dispose();
  }

  String _titleForKind(String kind) {
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

  DateTime _parseRecordedAt() {
    return DateTime.parse(_recordedAtController.text).toUtc();
  }

  Map<String, dynamic> _basePayload() {
    final memo = _memoController.text.trim();
    return {
      'recordedAt': _parseRecordedAt().toIso8601String(),
      'timeZone': kAppTimeZone,
      'inputSource': 'manual',
      if (memo.isNotEmpty) 'memo': memo,
    };
  }

  Future<void> _pickMealPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_rounded),
              title: const Text('カメラで撮影'),
              onTap: () => Navigator.of(context).pop(ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('ライブラリから選択'),
              onTap: () => Navigator.of(context).pop(ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    final picked =
        await _imagePicker.pickImage(source: source, imageQuality: 82);
    if (picked == null) return;
    setState(() => _mealPhotoPath = picked.path);
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);
    try {
      final api = widget.controller.api;
      final base = _basePayload();
      final isEdit = widget.record != null;
      final id = widget.record?['id'] as String?;

      if (_kind == 'blood_pressure') {
        final payload = {
          ...base,
          'systolic': int.parse(_systolicController.text),
          'diastolic': int.parse(_diastolicController.text),
          'period': _bpPeriod,
          if (_pulseController.text.trim().isNotEmpty)
            'pulse': int.parse(_pulseController.text),
        };
        if (isEdit && id != null) {
          await api.updateBloodPressure(id, payload);
        } else {
          await api.createBloodPressure(payload);
        }
      } else if (_kind == 'blood_glucose') {
        final payload = {
          ...base,
          'value': double.parse(_glucoseValueController.text),
          'unit': _glucoseUnit,
          'timing': _glucoseTiming,
        };
        if (isEdit && id != null) {
          await api.updateBloodGlucose(id, payload);
        } else {
          await api.createBloodGlucose(payload);
        }
      } else if (_kind == 'meal') {
        final payload = {
          ...base,
          'items': _mealItemsController.text.trim(),
          if (_mealCaloriesController.text.trim().isNotEmpty)
            'estimatedCalories': int.parse(_mealCaloriesController.text),
          if (_mealPhotoPath != null) 'photoUri': _mealPhotoPath,
        };
        if (isEdit && id != null) {
          await api.updateMeal(id, payload);
        } else {
          await api.createMeal(payload);
        }
      } else if (_kind == 'activity') {
        if (_activityStepsController.text.trim().isEmpty &&
            _activityMinutesController.text.trim().isEmpty &&
            _activityCaloriesController.text.trim().isEmpty) {
          throw StateError('歩数、活動分、消費カロリーのいずれかを入力してください');
        }
        final payload = {
          ...base,
          if (_activityStepsController.text.trim().isNotEmpty)
            'steps': int.parse(_activityStepsController.text),
          if (_activityMinutesController.text.trim().isNotEmpty)
            'activeMinutes': int.parse(_activityMinutesController.text),
          if (_activityCaloriesController.text.trim().isNotEmpty)
            'caloriesBurned': int.parse(_activityCaloriesController.text),
        };
        if (isEdit && id != null) {
          await api.updateActivity(id, payload);
        } else {
          await api.createActivity(payload);
        }
      } else {
        final payload = {
          ...base,
          'value': double.parse(_weightController.text),
        };
        if (isEdit && id != null) {
          await api.updateWeight(id, payload);
        } else {
          await api.createWeight(payload);
        }
      }

      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('保存に失敗しました: $error')),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final kindOptions = const [
      'blood_pressure',
      'blood_glucose',
      'meal',
      'weight',
      'activity'
    ];
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.record == null ? '新規入力' : '記録の編集',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                widget.record == null
                    ? 'Web と同じ項目を入力できます。'
                    : _titleForKind(_kind),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 20),
              if (widget.record == null) ...[
                DropdownButtonFormField<String>(
                  initialValue: _kind,
                  decoration: const InputDecoration(
                    labelText: '記録種別',
                    border: OutlineInputBorder(),
                  ),
                  items: kindOptions
                      .map(
                        (kind) => DropdownMenuItem(
                          value: kind,
                          child: Text(_titleForKind(kind)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => _kind = value ?? _kind),
                ),
                const SizedBox(height: 12),
              ] else
                DecoratedBox(
                  decoration: BoxDecoration(
                    color:
                        Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text('種別: ${_titleForKind(_kind)}'),
                  ),
                ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('recorded_at_field'),
                controller: _recordedAtController,
                decoration: const InputDecoration(
                  labelText: '日時 (yyyy-MM-ddTHH:mm)',
                  border: OutlineInputBorder(),
                ),
                validator: (value) =>
                    (value == null || value.isEmpty) ? '日時は必須です' : null,
              ),
              const SizedBox(height: 12),
              if (_kind == 'blood_pressure') ...[
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        key: const Key('bp_systolic_field'),
                        controller: _systolicController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: '最高血圧',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) =>
                            (value == null || value.isEmpty) ? '必須です' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        key: const Key('bp_diastolic_field'),
                        controller: _diastolicController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: '最低血圧',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) =>
                            (value == null || value.isEmpty) ? '必須です' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: const Key('bp_pulse_field'),
                  controller: _pulseController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '脈拍',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _bpPeriod,
                  decoration: const InputDecoration(
                    labelText: '時間帯',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'morning', child: Text('朝')),
                    DropdownMenuItem(value: 'evening', child: Text('夜')),
                    DropdownMenuItem(value: 'other', child: Text('その他')),
                  ],
                  onChanged: (value) =>
                      setState(() => _bpPeriod = value ?? _bpPeriod),
                ),
              ] else if (_kind == 'blood_glucose') ...[
                TextFormField(
                  key: const Key('glucose_value_field'),
                  controller: _glucoseValueController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '血糖値',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) =>
                      (value == null || value.isEmpty) ? '必須です' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _glucoseUnit,
                  decoration: const InputDecoration(
                    labelText: '単位',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'mg_dl', child: Text('mg/dL')),
                    DropdownMenuItem(value: 'mmol_l', child: Text('mmol/L')),
                  ],
                  onChanged: (value) =>
                      setState(() => _glucoseUnit = value ?? _glucoseUnit),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _glucoseTiming,
                  decoration: const InputDecoration(
                    labelText: '測定タイミング',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'fasting', child: Text('空腹時')),
                    DropdownMenuItem(value: 'postprandial', child: Text('食後')),
                    DropdownMenuItem(value: 'random', child: Text('随時')),
                  ],
                  onChanged: (value) =>
                      setState(() => _glucoseTiming = value ?? _glucoseTiming),
                ),
              ] else if (_kind == 'meal') ...[
                TextFormField(
                  key: const Key('meal_items_field'),
                  controller: _mealItemsController,
                  maxLines: 4,
                  decoration: const InputDecoration(
                    labelText: '食事内容',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) =>
                      (value == null || value.isEmpty) ? '必須です' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: const Key('meal_calories_field'),
                  controller: _mealCaloriesController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '推定カロリー',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                _MealRecommendationCard(profile: _profile),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  key: const Key('meal_photo_button'),
                  onPressed: _pickMealPhoto,
                  icon: const Icon(Icons.photo_camera_rounded),
                  label: const Text('写真を添付'),
                ),
                if (_mealPhotoPath != null) ...[
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.file(
                      File(_mealPhotoPath!),
                      height: 180,
                      fit: BoxFit.cover,
                    ),
                  ),
                ],
              ] else if (_kind == 'activity') ...[
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        key: const Key('activity_steps_field'),
                        controller: _activityStepsController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: '歩数',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        key: const Key('activity_minutes_field'),
                        controller: _activityMinutesController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: '活動分',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  key: const Key('activity_calories_field'),
                  controller: _activityCaloriesController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '消費カロリー',
                    border: OutlineInputBorder(),
                  ),
                ),
              ] else ...[
                TextFormField(
                  key: const Key('weight_value_field'),
                  controller: _weightController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '体重 (kg)',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) =>
                      (value == null || value.isEmpty) ? '必須です' : null,
                ),
              ],
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('record_memo_field'),
                controller: _memoController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'メモ',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 20),
              FilledButton(
                key: const Key('record_save_button'),
                onPressed: _saving ? null : _save,
                child: Text(
                    _saving ? '保存中…' : (widget.record == null ? '作成' : '保存')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MealRecommendationCard extends StatelessWidget {
  const _MealRecommendationCard({required this.profile});

  final Map<String, dynamic>? profile;

  @override
  Widget build(BuildContext context) {
    final recommendation = _calculateRecommendation(profile);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('食事の目安', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Text(
              '基礎代謝 (BMR): ${recommendation.bmr != null ? '${recommendation.bmr} kcal/日' : '算出不可'}',
            ),
            Text(
              '総消費カロリー (TDEE): ${recommendation.tdee != null ? '${recommendation.tdee} kcal/日' : '算出不可'}',
            ),
          ],
        ),
      ),
    );
  }
}

class _Recommendation {
  const _Recommendation({required this.bmr, required this.tdee});

  final int? bmr;
  final int? tdee;
}

_Recommendation _calculateRecommendation(Map<String, dynamic>? profile) {
  final weightKg = (profile?['latestWeightKg'] as num?)?.toDouble();
  final heightCm = (profile?['heightCm'] as num?)?.toDouble();
  final age = profile?['age'] as int?;
  final gender = profile?['gender'] as String?;
  final activityLevel = profile?['activityLevel'] as String?;
  final bmr = _calculateBmr(weightKg, heightCm, age, gender);
  final tdee = _calculateTdee(weightKg, heightCm, age, gender, activityLevel);
  return _Recommendation(bmr: bmr, tdee: tdee);
}

int? _calculateBmr(
  double? weightKg,
  double? heightCm,
  int? age,
  String? gender,
) {
  if (weightKg == null || heightCm == null || age == null) return null;
  if (gender != 'male' && gender != 'female') return null;
  final s = gender == 'male' ? 5 : -161;
  return (10 * weightKg + 6.25 * heightCm - 5 * age + s).round();
}

int? _calculateTdee(
  double? weightKg,
  double? heightCm,
  int? age,
  String? gender,
  String? activityLevel,
) {
  final bmr = _calculateBmr(weightKg, heightCm, age, gender);
  if (bmr == null || activityLevel == null) return null;
  const multiplier = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very_active': 1.9,
  };
  final factor = multiplier[activityLevel];
  if (factor == null) return null;
  return (bmr * factor).round();
}
