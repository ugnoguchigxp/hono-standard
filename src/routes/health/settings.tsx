import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@repo/design-system';
import { createFileRoute } from '@tanstack/react-router';
import { format, subDays } from 'date-fns';
import { Bell, Clock, Download, FileJson, FileSpreadsheet, Settings, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DesignSettings } from '../../components/DesignSettings';
import { healthRpc } from '../../lib/health-rpc';
import {
  useCreateHealthGoal,
  useHealthGoals,
  useHealthProfile,
  useReminderSettings,
  useUpdateHealthGoal,
  useUpdateHealthProfile,
  useUpdateReminderSetting,
  useWeights,
} from '../../modules/health/hooks/health.hooks';
import type { HealthGoal, ReminderSetting } from '../../types/health.types';

export const Route = createFileRoute('/health/settings')({
  component: HealthSettings,
});

function HealthSettings() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthAgoStr = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const { data: reminderData, isLoading: isReminderLoading } = useReminderSettings();
  const { data: profileData, isLoading: isProfileLoading } = useHealthProfile();
  const { data: weightData } = useWeights(monthAgoStr, todayStr);
  const { data: goalData } = useHealthGoals();
  const updateReminder = useUpdateReminderSetting();
  const updateProfile = useUpdateHealthProfile();
  const createGoal = useCreateHealthGoal();
  const updateGoal = useUpdateHealthGoal();

  const [exportRange, setExportRange] = useState({
    from: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
    format: 'json' as 'json' | 'csv',
  });
  const [profileForm, setProfileForm] = useState<{
    age: string;
    gender: '' | Gender;
    heightCm: string;
    activityLevel: '' | ActivityLevel;
  }>({
    age: '',
    gender: '',
    heightCm: '',
    activityLevel: '',
  });

  useEffect(() => {
    if (!profileData) return;
    setProfileForm({
      age: profileData.age != null ? String(profileData.age) : '',
      gender:
        profileData.gender === 'male' || profileData.gender === 'female' ? profileData.gender : '',
      heightCm: profileData.heightCm != null ? String(profileData.heightCm) : '',
      activityLevel:
        profileData.activityLevel === 'sedentary' ||
        profileData.activityLevel === 'light' ||
        profileData.activityLevel === 'moderate' ||
        profileData.activityLevel === 'active' ||
        profileData.activityLevel === 'very_active'
          ? profileData.activityLevel
          : '',
    });
  }, [profileData]);

  const handleUpdateReminder = async (type: string, enabled: boolean, time?: string) => {
    await updateReminder.mutateAsync({
      reminderType: type,
      input: {
        isEnabled: enabled,
        localTime:
          time ||
          (reminderData?.records as ReminderSetting[] | undefined)?.find(
            (r) => r.reminderType === type
          )?.localTime ||
          '08:00',
      },
    });
  };

  const handleExport = async () => {
    const res = await healthRpc.export.$get({
      query: {
        format: exportRange.format,
        from: exportRange.from,
        to: exportRange.to,
      },
    });
    if (!res.ok) throw new Error('Failed to export health data');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `health-export-${exportRange.from}-${exportRange.to}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const latestWeightKg = (() => {
    const latest = weightData?.records?.[0]?.value;
    if (typeof latest === 'number') return latest;
    return typeof profileData?.latestWeightKg === 'number' ? profileData.latestWeightKg : null;
  })();

  const ageValue =
    profileForm.age.trim() === '' ? null : Number.parseInt(profileForm.age.trim(), 10);
  const heightCmValue =
    profileForm.heightCm.trim() === '' ? null : Number.parseFloat(profileForm.heightCm.trim());
  const recommendedByForm =
    ageValue != null &&
    Number.isFinite(ageValue) &&
    heightCmValue != null &&
    Number.isFinite(heightCmValue) &&
    latestWeightKg != null &&
    profileForm.gender !== ''
      ? calculateBMR({
          weightKg: latestWeightKg,
          heightCm: heightCmValue,
          age: ageValue,
          gender: profileForm.gender,
        })
      : null;
  const recommendedTdee =
    recommendedByForm != null && profileForm.activityLevel !== ''
      ? calculateTDEE(
          {
            weightKg: latestWeightKg ?? 0,
            heightCm: heightCmValue ?? 0,
            age: ageValue ?? 0,
            gender: profileForm.gender as Gender,
          },
          profileForm.activityLevel
        )
      : null;

  const handleSaveProfile = async () => {
    if (
      (profileForm.age.trim() !== '' && (ageValue == null || Number.isNaN(ageValue))) ||
      (profileForm.heightCm.trim() !== '' && (heightCmValue == null || Number.isNaN(heightCmValue)))
    ) {
      window.alert('年齢または身長の入力値が不正です。');
      return;
    }
    await updateProfile.mutateAsync({
      age: profileForm.age.trim() === '' ? null : ageValue,
      gender: profileForm.gender === '' ? null : profileForm.gender,
      heightCm: profileForm.heightCm.trim() === '' ? null : heightCmValue,
      activityLevel: profileForm.activityLevel === '' ? null : profileForm.activityLevel,
    });
  };

  const handleApplyRecommendedMealGoal = async () => {
    if (recommendedTdee == null) {
      window.alert(
        '推奨摂取カロリーを算出できません。年齢・性別・身長・活動レベルを設定し、体重を記録してください。'
      );
      return;
    }

    const existingMealGoal = ((goalData?.records ?? []) as HealthGoal[]).find(
      (goal) => goal.goalType === 'daily_calorie_limit'
    );
    if (existingMealGoal) {
      await updateGoal.mutateAsync({
        id: existingMealGoal.id,
        input: {
          targetValue: recommendedTdee,
          isActive: true,
          memo: 'TDEE推奨値から設定',
        },
      });
    } else {
      await createGoal.mutateAsync({
        goalType: 'daily_calorie_limit',
        period: 'daily',
        targetValue: recommendedTdee,
        startsOn: todayStr,
        isActive: true,
        memo: 'TDEE推奨値から設定',
      });
    }
  };

  if (isReminderLoading || isProfileLoading)
    return <div className="p-8 text-center animate-pulse">読み込み中...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">設定・管理</h1>
        <p className="text-muted-foreground">リマインド設定とデータの管理を行います。</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* Body Profile Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">身体プロフィール・食事目標</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">BMR / TDEE の算出</CardTitle>
              <CardDescription>
                年齢・性別・身長・活動レベル・最新体重から、基礎代謝と総消費カロリーを計算します。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">年齢</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={profileForm.age}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        age: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">性別</Label>
                  <Select
                    value={profileForm.gender}
                    onValueChange={(value) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        gender: (value as Gender | '') ?? '',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">男性</SelectItem>
                      <SelectItem value="female">女性</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">身長 (cm)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={300}
                    value={profileForm.heightCm}
                    onChange={(e) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        heightCm: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">活動レベル</Label>
                  <Select
                    value={profileForm.activityLevel}
                    onValueChange={(value) =>
                      setProfileForm((prev) => ({
                        ...prev,
                        activityLevel: (value as ActivityLevel | '') ?? '',
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">ほぼ運動なし</SelectItem>
                      <SelectItem value="light">軽い運動</SelectItem>
                      <SelectItem value="moderate">中程度</SelectItem>
                      <SelectItem value="active">活発</SelectItem>
                      <SelectItem value="very_active">非常に活発</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
                <p>
                  最新体重: {latestWeightKg != null ? `${latestWeightKg.toFixed(1)} kg` : '未記録'}
                </p>
                <p>
                  基礎代謝 (BMR):
                  {recommendedByForm != null
                    ? ` ${recommendedByForm.toLocaleString()} kcal/日`
                    : ' 算出不可'}
                </p>
                <p>
                  総消費カロリー (TDEE):
                  {recommendedTdee != null
                    ? ` ${recommendedTdee.toLocaleString()} kcal/日`
                    : ' 算出不可'}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={updateProfile.isPending}
                onClick={() => void handleSaveProfile()}
              >
                プロフィールを保存
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={createGoal.isPending || updateGoal.isPending}
                onClick={() => void handleApplyRecommendedMealGoal()}
              >
                食事目標に反映 (TDEE ベース)
              </Button>
            </CardFooter>
          </Card>
        </section>

        {/* Reminders Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">リマインド設定</h2>
          </div>

          <div className="space-y-3">
            {(['blood_pressure', 'blood_glucose', 'meal'] as const).map((type) => {
              const setting = (reminderData?.records as ReminderSetting[] | undefined)?.find(
                (r) => r.reminderType === type
              );
              return (
                <Card key={type}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm">
                          {type === 'blood_pressure' && '血圧測定'}
                          {type === 'blood_glucose' && '血糖値測定'}
                          {type === 'meal' && '食事記録'}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <Input
                            type="time"
                            className="h-7 w-24 text-xs"
                            defaultValue={setting?.localTime || '08:00'}
                            onBlur={(e) =>
                              handleUpdateReminder(
                                type,
                                setting?.isEnabled ?? false,
                                e.target.value
                              )
                            }
                          />
                        </div>
                      </div>
                      <Switch
                        checked={setting?.isEnabled ?? false}
                        onCheckedChange={(v) => handleUpdateReminder(type, v)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground italic uppercase tracking-wider">
            ※リマインド通知はモバイルアプリ版でのみ配信されます。
          </p>
        </section>

        {/* Design Settings Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">表示・デザイン</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">外観のカスタマイズ</CardTitle>
              <CardDescription>テーマ、密度、フォントサイズなどを調整します。</CardDescription>
            </CardHeader>
            <CardContent>
              <DesignSettings />
            </CardContent>
          </Card>
        </section>

        {/* Export Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">データエクスポート</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">バックアップ / 外部連携</CardTitle>
              <CardDescription>登録済みの健康データを一括で書き出します。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">開始日</Label>
                  <Input
                    type="date"
                    value={exportRange.from}
                    onChange={(e) => setExportRange({ ...exportRange, from: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">終了日</Label>
                  <Input
                    type="date"
                    value={exportRange.to}
                    onChange={(e) => setExportRange({ ...exportRange, to: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">形式</Label>
                <div className="flex gap-2">
                  <Button
                    variant={exportRange.format === 'json' ? 'default' : 'outline'}
                    className="flex-1 text-xs"
                    onClick={() => setExportRange({ ...exportRange, format: 'json' })}
                  >
                    <FileJson className="h-4 w-4" />
                    JSON
                  </Button>
                  <Button
                    variant={exportRange.format === 'csv' ? 'default' : 'outline'}
                    className="flex-1 text-xs"
                    onClick={() => setExportRange({ ...exportRange, format: 'csv' })}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full font-bold uppercase tracking-tight"
                onClick={() => void handleExport()}
              >
                書き出しを開始
              </Button>
            </CardFooter>
          </Card>
        </section>
      </div>
    </div>
  );
}

type Gender = 'male' | 'female';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

interface BMRParams {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
}

function calculateBMR(params: BMRParams): number {
  const { weightKg, heightCm, age, gender } = params;
  const s = gender === 'male' ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;
  return Math.round(bmr);
}

const activityMultiplier: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function calculateTDEE(params: BMRParams, activity: ActivityLevel): number {
  return Math.round(calculateBMR(params) * activityMultiplier[activity]);
}
