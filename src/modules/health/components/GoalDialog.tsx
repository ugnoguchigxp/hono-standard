import {
  Button,
  Input,
  Label,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@repo/design-system';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import type { HealthGoal, HealthProfile } from '../../../types/health.types';
import { useCreateHealthGoal, useHealthProfile, useUpdateHealthGoal } from '../hooks/health.hooks';

interface GoalFormData {
  goalType: string;
  targetValue: number | string;
  targetMin?: string;
  targetMax?: string;
  startsOn: string;
  endsOn?: string;
  isActive: boolean;
  memo?: string;
}

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: HealthGoal | null;
}

export function GoalDialog({ open, onOpenChange, goal }: GoalDialogProps) {
  const { data: profileData } = useHealthProfile();
  const [formData, setFormData] = useState<GoalFormData>({
    goalType: 'daily_step_count',
    targetValue: 8000,
    startsOn: format(new Date(), 'yyyy-MM-dd'),
    isActive: true,
  });

  const createGoal = useCreateHealthGoal();
  const updateGoal = useUpdateHealthGoal();

  useEffect(() => {
    if (!open) return;

    if (goal) {
      setFormData({
        goalType: goal.goalType,
        targetValue: goal.targetValue,
        targetMin: goal.targetMin?.toString(),
        targetMax: goal.targetMax?.toString(),
        startsOn: goal.startsOn || goal.startDate,
        endsOn: goal.endsOn || goal.endDate || undefined,
        isActive: goal.isActive,
        memo: goal.memo,
      });
      return;
    }

    setFormData({
      goalType: 'daily_step_count',
      targetValue: 8000,
      startsOn: format(new Date(), 'yyyy-MM-dd'),
      isActive: true,
    });
  }, [goal, open]);

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        targetValue: formData.targetValue ? Number(formData.targetValue) : undefined,
        targetMin: formData.targetMin ? Number(formData.targetMin) : undefined,
        targetMax: formData.targetMax ? Number(formData.targetMax) : undefined,
      };

      if (goal) {
        await updateGoal.mutateAsync({ id: goal.id, input: payload });
      } else {
        await createGoal.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save goal:', error);
    }
  };

  const requiresRange =
    formData.goalType === 'blood_glucose_fasting_range' ||
    formData.goalType === 'blood_glucose_postprandial_range';
  const calorieRecommendation = getCalorieRecommendation(profileData);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      variant="consulter"
      title={goal ? '目標の編集' : '新しい目標の設定'}
      description="健康維持のための目標数値を設定します。"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={createGoal.isPending || updateGoal.isPending}>
            {goal ? '更新' : '作成'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="goalType">目標の種類</Label>
          <Select
            value={formData.goalType}
            onValueChange={(v) => setFormData({ ...formData, goalType: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="種類を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily_step_count">1日の歩数</SelectItem>
              <SelectItem value="blood_pressure_systolic_max">最高血圧 (上限)</SelectItem>
              <SelectItem value="blood_pressure_diastolic_max">最低血圧 (上限)</SelectItem>
              <SelectItem value="blood_glucose_fasting_range">空腹時血糖 (範囲)</SelectItem>
              <SelectItem value="blood_glucose_postprandial_range">食後血糖 (範囲)</SelectItem>
              <SelectItem value="daily_calorie_limit">1日トータル摂取カロリー (上限)</SelectItem>
              <SelectItem value="weekly_exercise_days">週の運動日数</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!requiresRange ? (
          <div className="grid gap-2">
            <Label htmlFor="targetValue">目標値</Label>
            <Input
              id="targetValue"
              type="number"
              value={formData.targetValue || ''}
              onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
            />
            {formData.goalType === 'daily_calorie_limit' && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p>
                  基礎代謝 (BMR):{' '}
                  {calorieRecommendation?.bmr != null
                    ? `${calorieRecommendation.bmr.toLocaleString()} kcal/日`
                    : '算出不可'}
                </p>
                <p>
                  総消費カロリー (TDEE):{' '}
                  {calorieRecommendation?.tdee != null
                    ? `${calorieRecommendation.tdee.toLocaleString()} kcal/日`
                    : '算出不可'}
                </p>
                <p className="mt-1">食事目標は TDEE を基準に調整してください。</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="targetMin">最小値</Label>
              <Input
                id="targetMin"
                type="number"
                value={formData.targetMin || ''}
                onChange={(e) => setFormData({ ...formData, targetMin: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetMax">最大値</Label>
              <Input
                id="targetMax"
                type="number"
                value={formData.targetMax || ''}
                onChange={(e) => setFormData({ ...formData, targetMax: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="startsOn">開始日</Label>
            <Input
              id="startsOn"
              type="date"
              value={formData.startsOn || ''}
              onChange={(e) => setFormData({ ...formData, startsOn: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="endsOn">終了日 (任意)</Label>
            <Input
              id="endsOn"
              type="date"
              value={formData.endsOn || ''}
              onChange={(e) => setFormData({ ...formData, endsOn: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="isActive" className="flex flex-col gap-1">
            <span>アクティブ</span>
            <span className="text-xs font-normal text-muted-foreground">
              この目標を現在の計測対象にします
            </span>
          </Label>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(v) => setFormData({ ...formData, isActive: v })}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="memo">メモ</Label>
          <Textarea
            id="memo"
            value={formData.memo || ''}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            placeholder="目標に関するメモ"
          />
        </div>
      </div>
    </Modal>
  );
}

type Gender = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

type CalorieRecommendation = {
  bmr: number | null;
  tdee: number | null;
};

function getCalorieRecommendation(profileData: HealthProfile | undefined): CalorieRecommendation {
  const weightKg =
    typeof profileData?.latestWeightKg === 'number' ? profileData.latestWeightKg : null;
  const age = typeof profileData?.age === 'number' ? profileData.age : null;
  const heightCm = typeof profileData?.heightCm === 'number' ? profileData.heightCm : null;
  const gender =
    profileData?.gender === 'male' || profileData?.gender === 'female'
      ? (profileData.gender as Gender)
      : null;
  const activityLevel = isActivityLevel(profileData?.activityLevel)
    ? (profileData.activityLevel as ActivityLevel)
    : null;

  const bmr = calculateBMR({ weightKg, heightCm, age, gender });
  const tdee = calculateTDEE({ weightKg, heightCm, age, gender }, activityLevel);
  return { bmr, tdee };
}

function calculateBMR(params: {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: Gender | null;
}): number | null {
  const { weightKg, heightCm, age, gender } = params;
  if (weightKg == null || heightCm == null || age == null || gender == null) return null;
  const s = gender === 'male' ? 5 : -161;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + s);
}

function calculateTDEE(
  params: {
    weightKg: number | null;
    heightCm: number | null;
    age: number | null;
    gender: Gender | null;
  },
  activityLevel: ActivityLevel | null
): number | null {
  const bmr = calculateBMR(params);
  if (bmr == null || activityLevel == null) return null;
  const multiplier: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return Math.round(bmr * multiplier[activityLevel]);
}

function isActivityLevel(value: unknown): value is ActivityLevel {
  return (
    value === 'sedentary' ||
    value === 'light' ||
    value === 'moderate' ||
    value === 'active' ||
    value === 'very_active'
  );
}
