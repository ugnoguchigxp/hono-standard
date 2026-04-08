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
  Textarea,
} from '@repo/design-system';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import type { HealthProfile } from '../../../types/health.types';
import {
  browserTimeZone,
  useCreateBloodGlucose,
  useCreateBloodPressure,
  useCreateMeal,
  useCreateWeight,
  useHealthProfile,
  useUpdateBloodGlucose,
  useUpdateBloodPressure,
  useUpdateMeal,
  useUpdateWeight,
} from '../hooks/health.hooks';

type RecordKind = 'bp' | 'glucose' | 'meal' | 'weight';

type RecordFormState = {
  kind: RecordKind;
  recordedAt: string;
  memo: string;
  systolic: string;
  diastolic: string;
  pulse: string;
  period: 'morning' | 'evening' | 'other';
  value: string;
  unit: 'mg_dl' | 'mmol_l';
  timing: 'fasting' | 'postprandial' | 'random';
  items: string;
  estimatedCalories: string;
};

export type RecordDialogRecord = {
  id: string;
  kind: RecordKind;
  recordedAt: string;
  memo?: string | null;
  systolic?: number | null;
  diastolic?: number | null;
  pulse?: number | null;
  period?: 'morning' | 'evening' | 'other';
  value?: number | null;
  unit?: 'mg_dl' | 'mmol_l';
  timing?: 'fasting' | 'postprandial' | 'random';
  items?: string;
  estimatedCalories?: number | null;
};

interface RecordEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: RecordDialogRecord | null;
  initialKind?: RecordKind;
}

const kindLabels: Record<RecordKind, string> = {
  bp: '血圧',
  glucose: '血糖',
  meal: '食事',
  weight: '体重',
};

const createDefaultState = (kind: RecordKind): RecordFormState => ({
  kind,
  recordedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  memo: '',
  systolic: '',
  diastolic: '',
  pulse: '',
  period: 'morning',
  value: '',
  unit: 'mg_dl',
  timing: 'fasting',
  items: '',
  estimatedCalories: '',
});

const fromRecord = (record: RecordDialogRecord): RecordFormState => ({
  kind: record.kind,
  recordedAt: format(new Date(record.recordedAt), "yyyy-MM-dd'T'HH:mm"),
  memo: record.memo ?? '',
  systolic: record.systolic != null ? String(record.systolic) : '',
  diastolic: record.diastolic != null ? String(record.diastolic) : '',
  pulse: record.pulse != null ? String(record.pulse) : '',
  period: record.period ?? 'morning',
  value: record.value != null ? String(record.value) : '',
  unit: record.unit ?? 'mg_dl',
  timing: record.timing ?? 'fasting',
  items: record.items ?? '',
  estimatedCalories: record.estimatedCalories != null ? String(record.estimatedCalories) : '',
});

const toIsoValue = (localValue: string) => new Date(localValue).toISOString();
const toOptionalNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));

export function RecordEditDialog({
  open,
  onOpenChange,
  record,
  initialKind = 'weight',
}: RecordEditDialogProps) {
  const [formData, setFormData] = useState<RecordFormState>(createDefaultState(initialKind));
  const { data: profileData } = useHealthProfile();

  const createBp = useCreateBloodPressure();
  const updateBp = useUpdateBloodPressure();
  const createGlucose = useCreateBloodGlucose();
  const updateGlucose = useUpdateBloodGlucose();
  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const createWeight = useCreateWeight();
  const updateWeight = useUpdateWeight();

  const isEditMode = Boolean(record?.id);
  const currentKind = formData.kind;
  const saveDisabled = useMemo(
    () =>
      createBp.isPending ||
      updateBp.isPending ||
      createGlucose.isPending ||
      updateGlucose.isPending ||
      createMeal.isPending ||
      updateMeal.isPending ||
      createWeight.isPending ||
      updateWeight.isPending,
    [
      createBp.isPending,
      updateBp.isPending,
      createGlucose.isPending,
      updateGlucose.isPending,
      createMeal.isPending,
      updateMeal.isPending,
      createWeight.isPending,
      updateWeight.isPending,
    ]
  );

  useEffect(() => {
    if (!open) return;

    if (record) {
      setFormData(fromRecord(record));
      return;
    }

    setFormData(createDefaultState(initialKind));
  }, [initialKind, open, record]);

  const changeKind = (nextKind: RecordKind) => {
    if (isEditMode) return;
    setFormData((current) => ({
      ...createDefaultState(nextKind),
      recordedAt: current.recordedAt,
      memo: current.memo,
    }));
  };

  const saveRecord = async () => {
    try {
      const timeZone = browserTimeZone();
      const basePayload = {
        recordedAt: toIsoValue(formData.recordedAt),
        memo: formData.memo.trim() || undefined,
      };

      if (isEditMode && record) {
        if (currentKind === 'bp') {
          await updateBp.mutateAsync({
            id: record.id,
            input: {
              ...basePayload,
              systolic: Number(formData.systolic),
              diastolic: Number(formData.diastolic),
              pulse: toOptionalNumber(formData.pulse),
              period: formData.period,
            },
          });
        } else if (currentKind === 'glucose') {
          await updateGlucose.mutateAsync({
            id: record.id,
            input: {
              ...basePayload,
              value: Number(formData.value),
              unit: formData.unit,
              timing: formData.timing,
            },
          });
        } else if (currentKind === 'meal') {
          await updateMeal.mutateAsync({
            id: record.id,
            input: {
              ...basePayload,
              items: formData.items,
              estimatedCalories: toOptionalNumber(formData.estimatedCalories),
            },
          });
        } else {
          await updateWeight.mutateAsync({
            id: record.id,
            input: {
              ...basePayload,
              value: Number(formData.value),
            },
          });
        }
      } else if (currentKind === 'bp') {
        await createBp.mutateAsync({
          ...basePayload,
          timeZone,
          systolic: Number(formData.systolic),
          diastolic: Number(formData.diastolic),
          pulse: toOptionalNumber(formData.pulse),
          period: formData.period,
        });
      } else if (currentKind === 'glucose') {
        await createGlucose.mutateAsync({
          ...basePayload,
          timeZone,
          value: Number(formData.value),
          unit: formData.unit,
          timing: formData.timing,
        });
      } else if (currentKind === 'meal') {
        await createMeal.mutateAsync({
          ...basePayload,
          timeZone,
          items: formData.items,
          estimatedCalories: toOptionalNumber(formData.estimatedCalories),
        });
      } else {
        await createWeight.mutateAsync({
          ...basePayload,
          timeZone,
          value: Number(formData.value),
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save record:', error);
    }
  };

  const title = isEditMode ? '記録の編集' : '新規入力';
  const description = isEditMode ? '健康記録の内容を修正します。' : '健康記録を入力します。';
  const saveLabel = isEditMode ? '保存' : '作成';
  const mealRecommendation = getMealRecommendation(profileData);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      variant="employee"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={saveRecord} disabled={saveDisabled}>
            {saveLabel}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 py-4">
        {!isEditMode && (
          <div className="grid gap-2">
            <Label htmlFor="kind">記録種別</Label>
            <Select value={currentKind} onValueChange={(value) => changeKind(value as RecordKind)}>
              <SelectTrigger id="kind">
                <SelectValue placeholder="種別を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weight">{kindLabels.weight}</SelectItem>
                <SelectItem value="bp">{kindLabels.bp}</SelectItem>
                <SelectItem value="glucose">{kindLabels.glucose}</SelectItem>
                <SelectItem value="meal">{kindLabels.meal}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isEditMode && record && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            種別: {kindLabels[record.kind]}
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="date">日時</Label>
          <Input
            id="date"
            type="datetime-local"
            value={formData.recordedAt}
            onChange={(e) => setFormData({ ...formData, recordedAt: e.target.value })}
          />
        </div>

        {currentKind === 'bp' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="systolic">最高血圧 (mmHg)</Label>
                <Input
                  id="systolic"
                  type="number"
                  value={formData.systolic}
                  onChange={(e) => setFormData({ ...formData, systolic: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="diastolic">最低血圧 (mmHg)</Label>
                <Input
                  id="diastolic"
                  type="number"
                  value={formData.diastolic}
                  onChange={(e) => setFormData({ ...formData, diastolic: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pulse">脈拍 (bpm)</Label>
              <Input
                id="pulse"
                type="number"
                value={formData.pulse}
                onChange={(e) => setFormData({ ...formData, pulse: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="period">時間帯</Label>
              <Select
                value={formData.period}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    period: value as RecordFormState['period'],
                  })
                }
              >
                <SelectTrigger id="period">
                  <SelectValue placeholder="時間帯を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">朝</SelectItem>
                  <SelectItem value="evening">夜</SelectItem>
                  <SelectItem value="other">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {currentKind === 'glucose' && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="value">血糖値</Label>
              <Input
                id="value"
                type="number"
                step="0.1"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">単位</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    unit: value as RecordFormState['unit'],
                  })
                }
              >
                <SelectTrigger id="unit">
                  <SelectValue placeholder="単位を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mg_dl">mg/dL</SelectItem>
                  <SelectItem value="mmol_l">mmol/L</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timing">タイミング</Label>
              <Select
                value={formData.timing}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    timing: value as RecordFormState['timing'],
                  })
                }
              >
                <SelectTrigger id="timing">
                  <SelectValue placeholder="タイミングを選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fasting">空腹時</SelectItem>
                  <SelectItem value="postprandial">食後</SelectItem>
                  <SelectItem value="random">随時</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {currentKind === 'meal' && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="items">内容</Label>
              <Textarea
                id="items"
                value={formData.items}
                onChange={(e) => setFormData({ ...formData, items: e.target.value })}
                placeholder="何を食べましたか？"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="calories">推定カロリー (kcal)</Label>
              <Input
                id="calories"
                type="number"
                value={formData.estimatedCalories}
                onChange={(e) => setFormData({ ...formData, estimatedCalories: e.target.value })}
              />
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                基礎代謝 (BMR):{' '}
                {mealRecommendation?.bmr != null
                  ? `${mealRecommendation.bmr.toLocaleString()} kcal/日`
                  : '算出不可'}
              </p>
              <p>
                総消費カロリー (TDEE):{' '}
                {mealRecommendation?.tdee != null
                  ? `${mealRecommendation.tdee.toLocaleString()} kcal/日`
                  : '算出不可'}
              </p>
              <p className="mt-1">食事記録の目安として TDEE を参照できます。</p>
            </div>
          </>
        )}

        {currentKind === 'weight' && (
          <div className="grid gap-2">
            <Label htmlFor="weight">体重 (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="memo">メモ</Label>
          <Textarea
            id="memo"
            value={formData.memo}
            onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
          />
        </div>
      </div>
    </Modal>
  );
}

type Gender = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

type MealRecommendation = {
  bmr: number | null;
  tdee: number | null;
};

function getMealRecommendation(profileData: HealthProfile | undefined): MealRecommendation | null {
  if (!profileData) return null;
  const weightKg =
    typeof profileData.latestWeightKg === 'number' ? profileData.latestWeightKg : null;
  const age = typeof profileData.age === 'number' ? profileData.age : null;
  const heightCm = typeof profileData.heightCm === 'number' ? profileData.heightCm : null;
  const gender =
    profileData.gender === 'male' || profileData.gender === 'female'
      ? (profileData.gender as Gender)
      : null;
  const activityLevel = isActivityLevel(profileData.activityLevel)
    ? (profileData.activityLevel as ActivityLevel)
    : null;

  const bmr = calculateBmr(weightKg, heightCm, age, gender);
  const tdee = calculateTdee(weightKg, heightCm, age, gender, activityLevel);
  return { bmr, tdee };
}

function calculateBmr(
  weightKg: number | null,
  heightCm: number | null,
  age: number | null,
  gender: Gender | null
): number | null {
  if (weightKg == null || heightCm == null || age == null || gender == null) return null;
  const s = gender === 'male' ? 5 : -161;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + s);
}

function calculateTdee(
  weightKg: number | null,
  heightCm: number | null,
  age: number | null,
  gender: Gender | null,
  activityLevel: ActivityLevel | null
): number | null {
  const bmr = calculateBmr(weightKg, heightCm, age, gender);
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
