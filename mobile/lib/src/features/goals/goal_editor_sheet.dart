import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class GoalEditorPayload {
  GoalEditorPayload({
    required this.goalType,
    required this.period,
    required this.startsOn,
    required this.endsOn,
    required this.isActive,
    required this.memo,
    required this.targetValue,
    required this.targetMin,
    required this.targetMax,
  });

  final String goalType;
  final String period;
  final String startsOn;
  final String? endsOn;
  final bool isActive;
  final String? memo;
  final double? targetValue;
  final double? targetMin;
  final double? targetMax;

  Map<String, dynamic> toJson() => {
        'goalType': goalType,
        'period': period,
        'startsOn': startsOn,
        if (endsOn != null) 'endsOn': endsOn,
        'isActive': isActive,
        if (memo != null) 'memo': memo,
        if (targetValue != null) 'targetValue': targetValue,
        if (targetMin != null) 'targetMin': targetMin,
        if (targetMax != null) 'targetMax': targetMax,
      };
}

Future<GoalEditorPayload?> showGoalEditorSheet(
  BuildContext context, {
  required List<String> allowedGoalTypes,
  Map<String, dynamic>? goal,
  Map<String, dynamic>? profile,
}) {
  return showModalBottomSheet<GoalEditorPayload>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => GoalEditorSheet(
      allowedGoalTypes: allowedGoalTypes,
      goal: goal,
      profile: profile,
    ),
  );
}

class GoalEditorSheet extends StatefulWidget {
  const GoalEditorSheet({
    super.key,
    required this.allowedGoalTypes,
    this.goal,
    this.profile,
  });

  final List<String> allowedGoalTypes;
  final Map<String, dynamic>? goal;
  final Map<String, dynamic>? profile;

  @override
  State<GoalEditorSheet> createState() => _GoalEditorSheetState();
}

class _GoalEditorSheetState extends State<GoalEditorSheet> {
  final _formKey = GlobalKey<FormState>();
  late String _goalType;
  late final TextEditingController _startsOnController;
  late final TextEditingController _endsOnController;
  late final TextEditingController _targetValueController;
  late final TextEditingController _targetMinController;
  late final TextEditingController _targetMaxController;
  late final TextEditingController _memoController;
  bool _isActive = true;
  bool _hasEndsOn = false;

  @override
  void initState() {
    super.initState();
    _goalType =
        widget.goal?['goalType'] as String? ?? widget.allowedGoalTypes.first;
    _startsOnController = TextEditingController(
      text: widget.goal?['startsOn'] as String? ??
          DateFormat('yyyy-MM-dd').format(DateTime.now()),
    );
    _endsOnController =
        TextEditingController(text: widget.goal?['endsOn'] as String? ?? '');
    _targetValueController = TextEditingController(
        text: widget.goal?['targetValue']?.toString() ?? '');
    _targetMinController = TextEditingController(
        text: widget.goal?['targetMin']?.toString() ?? '');
    _targetMaxController = TextEditingController(
        text: widget.goal?['targetMax']?.toString() ?? '');
    _memoController =
        TextEditingController(text: widget.goal?['memo'] as String? ?? '');
    _isActive = widget.goal?['isActive'] != false;
    _hasEndsOn = (widget.goal?['endsOn'] as String?)?.isNotEmpty == true;
  }

  @override
  void dispose() {
    _startsOnController.dispose();
    _endsOnController.dispose();
    _targetValueController.dispose();
    _targetMinController.dispose();
    _targetMaxController.dispose();
    _memoController.dispose();
    super.dispose();
  }

  bool get _requiresRange =>
      _goalType == 'blood_glucose_fasting_range' ||
      _goalType == 'blood_glucose_postprandial_range';

  String get _period =>
      _goalType == 'weekly_exercise_days' ? 'weekly' : 'daily';

  _CalorieRecommendation get _calorieRecommendation =>
      _computeCalorieRecommendation(widget.profile);

  Future<void> _pickDate(TextEditingController controller,
      {DateTime? initialDate}) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: initialDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      controller.text = DateFormat('yyyy-MM-dd').format(picked);
    }
  }

  void _save() {
    if (!_formKey.currentState!.validate()) return;
    final payload = GoalEditorPayload(
      goalType: _goalType,
      period: _period,
      startsOn: _startsOnController.text.trim(),
      endsOn: _hasEndsOn && _endsOnController.text.trim().isNotEmpty
          ? _endsOnController.text.trim()
          : null,
      isActive: _isActive,
      memo: _memoController.text.trim().isEmpty
          ? null
          : _memoController.text.trim(),
      targetValue: _requiresRange
          ? null
          : double.tryParse(_targetValueController.text.trim()),
      targetMin: _requiresRange
          ? double.tryParse(_targetMinController.text.trim())
          : null,
      targetMax: _requiresRange
          ? double.tryParse(_targetMaxController.text.trim())
          : null,
    );
    Navigator.of(context).pop(payload);
  }

  @override
  Widget build(BuildContext context) {
    final showTypePicker = widget.allowedGoalTypes.length > 1;
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
                      widget.goal == null ? '目標の設定' : '目標の編集',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '計測項目ごとの目標を設定します。',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 20),
              if (showTypePicker) ...[
                DropdownButtonFormField<String>(
                  initialValue: _goalType,
                  decoration: const InputDecoration(
                    labelText: '目標種別',
                    border: OutlineInputBorder(),
                  ),
                  items: widget.allowedGoalTypes
                      .map(
                        (type) => DropdownMenuItem(
                          value: type,
                          child: Text(_labelForType(type)),
                        ),
                      )
                      .toList(),
                  onChanged: (value) =>
                      setState(() => _goalType = value ?? _goalType),
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
                    child: Text('目標種別: ${_labelForType(_goalType)}'),
                  ),
                ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      key: const Key('goal_starts_on_field'),
                      controller: _startsOnController,
                      readOnly: true,
                      decoration: const InputDecoration(
                        labelText: '開始日',
                        border: OutlineInputBorder(),
                      ),
                      onTap: () => _pickDate(_startsOnController),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      key: const Key('goal_ends_on_field'),
                      controller: _endsOnController,
                      readOnly: true,
                      enabled: _hasEndsOn,
                      decoration: const InputDecoration(
                        labelText: '終了日',
                        border: OutlineInputBorder(),
                      ),
                      onTap: _hasEndsOn
                          ? () => _pickDate(_endsOnController)
                          : null,
                    ),
                  ),
                ],
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('終了日を設定'),
                value: _hasEndsOn,
                onChanged: (value) => setState(() => _hasEndsOn = value),
              ),
              const SizedBox(height: 12),
              if (_goalType == 'daily_calorie_limit') ...[
                _CalorieInfoCard(recommendation: _calorieRecommendation),
                const SizedBox(height: 12),
              ],
              if (_requiresRange) ...[
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        key: const Key('goal_target_min_field'),
                        controller: _targetMinController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: '下限',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) =>
                            (value == null || value.isEmpty) ? '必須です' : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        key: const Key('goal_target_max_field'),
                        controller: _targetMaxController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: '上限',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) =>
                            (value == null || value.isEmpty) ? '必須です' : null,
                      ),
                    ),
                  ],
                ),
              ] else ...[
                TextFormField(
                  key: const Key('goal_target_value_field'),
                  controller: _targetValueController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: '目標値',
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) =>
                      (value == null || value.isEmpty) ? '必須です' : null,
                ),
              ],
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('goal_memo_field'),
                controller: _memoController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'メモ',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('有効'),
                value: _isActive,
                onChanged: (value) => setState(() => _isActive = value),
              ),
              const SizedBox(height: 20),
              FilledButton(
                key: const Key('goal_save_button'),
                onPressed: _save,
                child: Text(widget.goal == null ? '作成' : '更新'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _labelForType(String type) {
    switch (type) {
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
        return type;
    }
  }
}

class _CalorieRecommendation {
  const _CalorieRecommendation({required this.bmr, required this.tdee});

  final int? bmr;
  final int? tdee;
}

class _CalorieInfoCard extends StatelessWidget {
  const _CalorieInfoCard({required this.recommendation});

  final _CalorieRecommendation recommendation;

  @override
  Widget build(BuildContext context) {
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
            Text(
              '食事目標の目安',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 4),
            Text(
              '基礎代謝 (BMR): ${recommendation.bmr != null ? '${recommendation.bmr} kcal/日' : '算出不可'}',
            ),
            Text(
              '総消費カロリー (TDEE): ${recommendation.tdee != null ? '${recommendation.tdee} kcal/日' : '算出不可'}',
            ),
            const SizedBox(height: 4),
            Text(
              '食事目標は TDEE を基準に調整してください。',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

_CalorieRecommendation _computeCalorieRecommendation(
    Map<String, dynamic>? profile) {
  final weightKg = (profile?['latestWeightKg'] as num?)?.toDouble();
  final heightCm = (profile?['heightCm'] as num?)?.toDouble();
  final age = profile?['age'] as int?;
  final gender = profile?['gender'] as String?;
  final activityLevel = profile?['activityLevel'] as String?;

  final bmr = _calculateBmr(
    weightKg: weightKg,
    heightCm: heightCm,
    age: age,
    gender: gender,
  );
  final tdee = _calculateTdee(
    weightKg: weightKg,
    heightCm: heightCm,
    age: age,
    gender: gender,
    activityLevel: activityLevel,
  );
  return _CalorieRecommendation(bmr: bmr, tdee: tdee);
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
  return (10 * weightKg + 6.25 * heightCm - 5 * age + s).round();
}

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
