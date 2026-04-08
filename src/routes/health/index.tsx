import { createFileRoute } from '@tanstack/react-router';
import { format, startOfWeek, subDays } from 'date-fns';
import { AchievementSummary } from '../../modules/health/components/AchievementSummary';
import { DailySummaryCard } from '../../modules/health/components/DailySummaryCard';
import { HealthTrendChart } from '../../modules/health/components/HealthTrendChart';
import {
  useBloodGlucose,
  useBloodPressure,
  useDailySummary,
  useHealthAlerts,
  useWeeklyHealthReport,
  useWeights,
} from '../../modules/health/hooks/health.hooks';

export const Route = createFileRoute('/health/')({
  component: HealthDashboard,
});

function HealthDashboard() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekAgoStr = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const weekStartStr = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: summary, isLoading: isSummaryLoading } = useDailySummary(todayStr);
  const { data: bpRecords, isLoading: isBpLoading } = useBloodPressure(weekAgoStr, todayStr);
  const { data: gRecords, isLoading: isGLoading } = useBloodGlucose(weekAgoStr, todayStr);
  const { data: weightRecords, isLoading: isWeightLoading } = useWeights(weekAgoStr, todayStr);
  const { data: alerts, isLoading: isAlertsLoading } = useHealthAlerts(false, 3);
  const { data: weeklyReport, isLoading: isWeeklyReportLoading } =
    useWeeklyHealthReport(weekStartStr);
  const alertRows = (alerts?.records ?? []) as Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
  }>;

  if (
    isSummaryLoading ||
    isBpLoading ||
    isGLoading ||
    isWeightLoading ||
    isAlertsLoading ||
    isWeeklyReportLoading
  ) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex animate-pulse flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-accent" />
          <p className="text-sm font-medium text-muted-foreground">健康データを読み込み中…</p>
        </div>
      </div>
    );
  }

  const bpChartData =
    bpRecords?.records
      ?.map((r: { recordedAt: string; systolic: number; diastolic: number }) => ({
        date: format(new Date(r.recordedAt), 'MM/dd HH:mm'),
        systolic: r.systolic,
        diastolic: r.diastolic,
      }))
      .reverse() ?? [];

  const gChartData =
    gRecords?.records
      ?.map((r: { recordedAt: string; value: number }) => ({
        date: format(new Date(r.recordedAt), 'MM/dd HH:mm'),
        value: r.value,
      }))
      .reverse() ?? [];

  return (
    <div className="fade-in animate-in space-y-8 duration-700">
      <header>
        <h1 className="mb-1 text-3xl font-bold tracking-tight">今日のサマリ</h1>
        <p className="italic text-muted-foreground">
          {format(new Date(), 'M月 d日')} — 歩数・血圧・血糖・食事の概要です。
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
          日次
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <DailySummaryCard
              steps={summary?.stepsTotal ?? 0}
              stepsGoal={8000}
              calories={summary?.activityCaloriesTotal ?? 0}
              caloriesGoal={2500}
              mealCount={summary?.mealCount ?? 0}
              latestBloodPressure={
                summary?.latestBloodPressure
                  ? {
                      systolic: summary.latestBloodPressure.systolic,
                      diastolic: summary.latestBloodPressure.diastolic,
                      pulse: summary.latestBloodPressure.pulse,
                    }
                  : null
              }
              latestBloodGlucose={
                summary?.latestBloodGlucose
                  ? {
                      value: summary.latestBloodGlucose.value,
                      unit: summary.latestBloodGlucose.unit,
                    }
                  : null
              }
              latestWeight={
                weightRecords?.records?.[0]
                  ? {
                      value: weightRecords.records[0].value,
                    }
                  : null
              }
            />
          </div>
          <div className="lg:col-span-1">
            <AchievementSummary />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
            未読アラート
          </h2>
          {alertRows.length ? (
            <div className="space-y-3">
              {alertRows.map((alert) => (
                <div key={alert.id} className="rounded-lg border bg-background/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {alert.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">未読アラートはありません。</p>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
            週次レポート
          </h2>
          {weeklyReport?.report ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">
                {weeklyReport.report.weekStart} - {weeklyReport.report.weekEnd}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">歩数合計</p>
                  <p className="font-semibold">{weeklyReport.report.stepsTotal.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground">目標達成率</p>
                  <p className="font-semibold">
                    {weeklyReport.report.goalAchievementRateAverage != null
                      ? `${Math.round(weeklyReport.report.goalAchievementRateAverage)}%`
                      : '—'}
                  </p>
                </div>
              </div>
              {weeklyReport.report.summary && (
                <p className="text-xs text-muted-foreground">{weeklyReport.report.summary}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">今週のレポートはまだありません。</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HealthTrendChart
          title="血圧（直近7日）"
          data={bpChartData}
          lines={[
            { key: 'systolic', name: '収縮期', color: '#ef4444' },
            { key: 'diastolic', name: '拡張期', color: '#3b82f6' },
          ]}
        />
        <HealthTrendChart
          title="血糖（直近7日）"
          data={gChartData}
          lines={[{ key: 'value', name: '血糖値', color: '#10b981' }]}
        />
      </section>
    </div>
  );
}
