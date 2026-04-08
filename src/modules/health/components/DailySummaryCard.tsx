import { Activity, Droplet, Flame, Footprints, HeartPulse, Scale, Utensils } from 'lucide-react';

export interface DailySummaryLatestBp {
  systolic: number;
  diastolic: number;
  pulse: number | null;
}

export interface DailySummaryLatestGlucose {
  value: number;
  unit: string;
}

export interface DailySummaryLatestWeight {
  value: number;
}

interface DailySummaryCardProps {
  steps: number;
  stepsGoal: number;
  calories: number;
  caloriesGoal: number;
  mealCount: number;
  latestBloodPressure?: DailySummaryLatestBp | null;
  latestBloodGlucose?: DailySummaryLatestGlucose | null;
  latestWeight?: DailySummaryLatestWeight | null;
}

export function DailySummaryCard({
  steps,
  stepsGoal,
  calories,
  caloriesGoal,
  mealCount,
  latestBloodPressure,
  latestBloodGlucose,
  latestWeight,
}: DailySummaryCardProps) {
  const stepsProgress = Math.min((steps / stepsGoal) * 100, 100);
  const caloriesProgress = Math.min((calories / caloriesGoal) * 100, 100);
  const latestWeightValue =
    latestWeight?.value != null
      ? Number.isInteger(latestWeight.value)
        ? latestWeight.value.toFixed(0)
        : latestWeight.value.toFixed(1)
      : null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
            <Footprints className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              歩数
            </p>
            <h3 className="text-2xl font-bold tracking-tight">{steps.toLocaleString()}</h3>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-blue-500 transition-all duration-1000 ease-out"
              style={{ width: `${stepsProgress}%` }}
            />
          </div>
          <p className="text-right text-[10px] text-muted-foreground">
            目標: {stepsGoal.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-orange-100 p-2 text-orange-600">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              活動カロリー
            </p>
            <h3 className="text-2xl font-bold tracking-tight">
              {calories.toLocaleString()}{' '}
              <span className="text-sm font-normal text-muted-foreground">kcal</span>
            </h3>
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-orange-500 transition-all duration-1000 ease-out"
              style={{ width: `${caloriesProgress}%` }}
            />
          </div>
          <p className="text-right text-[10px] text-muted-foreground">
            目標: {caloriesGoal.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              最新 血圧
            </p>
            {latestBloodPressure ? (
              <h3 className="text-xl font-bold tracking-tight">
                {latestBloodPressure.systolic} / {latestBloodPressure.diastolic}
                <span className="ml-1 text-xs font-normal text-muted-foreground">mmHg</span>
              </h3>
            ) : (
              <h3 className="text-lg text-muted-foreground">—</h3>
            )}
            {latestBloodPressure?.pulse != null && (
              <p className="text-xs text-muted-foreground">脈拍 {latestBloodPressure.pulse}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
            <Droplet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              最新 血糖
            </p>
            {latestBloodGlucose ? (
              <h3 className="text-xl font-bold tracking-tight">
                {latestBloodGlucose.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {latestBloodGlucose.unit}
                </span>
              </h3>
            ) : (
              <h3 className="text-lg text-muted-foreground">—</h3>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              最新 体重
            </p>
            {latestWeightValue ? (
              <h3 className="text-xl font-bold tracking-tight">
                {latestWeightValue}
                <span className="ml-1 text-xs font-normal text-muted-foreground">kg</span>
              </h3>
            ) : (
              <h3 className="text-lg text-muted-foreground">—</h3>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md lg:col-span-2">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-green-100 p-2 text-green-600">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              食事（件数）
            </p>
            <h3 className="text-2xl font-bold tracking-tight">
              {mealCount} <span className="text-sm font-normal text-muted-foreground">件</span>
            </h3>
          </div>
        </div>
        <p className="text-xs italic text-muted-foreground">今日記録された食事</p>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md lg:col-span-2">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ステータス
            </p>
            <h3 className="text-lg font-bold tracking-tight">記録を続けましょう</h3>
          </div>
        </div>
        <p className="text-xs italic text-muted-foreground">
          ヘルス記録は /health/history から確認できます
        </p>
      </div>
    </div>
  );
}
