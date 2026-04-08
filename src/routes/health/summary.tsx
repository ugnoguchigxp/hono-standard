import { createFileRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HealthTrendChart } from '../../modules/health/components/HealthTrendChart';
import { useMonthlySummary, useWeeklySummary } from '../../modules/health/hooks/health.hooks';

export const Route = createFileRoute('/health/summary')({
  component: HealthSummary,
});

function startOfIsoWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function HealthSummary() {
  const [weekAnchor, setWeekAnchor] = useState(() => startOfIsoWeekMonday(new Date()));
  const weekStartStr = format(weekAnchor, 'yyyy-MM-dd');
  const { data: weekly, isLoading: wLoading } = useWeeklySummary(weekStartStr);

  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const monthStr = format(monthAnchor, 'yyyy-MM');
  const { data: monthly, isLoading: mLoading } = useMonthlySummary(monthStr);

  const weekChartData = useMemo(() => {
    if (!weekly?.days) return [];
    return weekly.days.map((d: { date: string; stepsTotal: number; mealCount: number }) => ({
      date: d.date.slice(8),
      steps: d.stepsTotal,
      meals: d.mealCount,
    }));
  }, [weekly]);

  const monthChartData = useMemo(() => {
    if (!monthly?.days) return [];
    return monthly.days.map((d: { date: string; stepsTotal: number; mealCount: number }) => ({
      date: d.date.slice(8),
      steps: d.stepsTotal,
      meals: d.mealCount,
    }));
  }, [monthly]);

  const shiftWeek = (delta: number) => {
    const n = new Date(weekAnchor);
    n.setDate(n.getDate() + delta * 7);
    setWeekAnchor(startOfIsoWeekMonday(n));
  };

  const shiftMonth = (delta: number) => {
    const n = new Date(monthAnchor);
    n.setMonth(n.getMonth() + delta);
    setMonthAnchor(n);
  };

  return (
    <div className="slide-in-from-bottom-4 animate-in space-y-8 duration-700">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">週次・月次サマリ</h1>
          <p className="text-sm italic text-muted-foreground">
            API: weekly / monthly を表示します。
          </p>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            週次（{weekly?.weekStart} 〜 {weekly?.weekEnd}）
          </h2>
          <div className="flex items-center gap-1 rounded-xl border bg-muted/30 p-1">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-background"
              onClick={() => shiftWeek(-1)}
              aria-label="前の週"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm font-medium">
              {wLoading
                ? '…'
                : `平均収縮期 ${weekly?.avgSystolic?.toFixed(0) ?? '—'} / 平均拡張期 ${weekly?.avgDiastolic?.toFixed(0) ?? '—'}`}
            </span>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-background"
              onClick={() => shiftWeek(1)}
              aria-label="次の週"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {!wLoading && weekly && (
          <p className="text-sm text-muted-foreground">
            血圧サンプル数: {weekly.bloodPressureSampleCount}
          </p>
        )}
        <HealthTrendChart
          title="週の歩数・食事（日別）"
          data={weekChartData}
          lines={[
            { key: 'steps', name: '歩数', color: '#6366f1' },
            { key: 'meals', name: '食事数', color: '#f59e0b' },
          ]}
        />
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            月次 {format(monthAnchor, 'yyyy年 M月')}
          </h2>
          <div className="flex items-center gap-1 rounded-xl border bg-muted/30 p-1">
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-background"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 hover:bg-background"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {mLoading ? (
          <p className="text-muted-foreground">読み込み中…</p>
        ) : monthly ? (
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground">月合計歩数</p>
              <p className="text-2xl font-bold">
                {monthly.stepsTotal?.toLocaleString?.() ?? monthly.stepsTotal}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground">食事（件数合計）</p>
              <p className="text-2xl font-bold">{monthly.mealCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground">日平均歩数</p>
              <p className="text-2xl font-bold">
                {monthly.avgSteps?.toLocaleString?.() ?? monthly.avgSteps}
              </p>
            </div>
          </div>
        ) : null}
        <HealthTrendChart
          title="月の歩数・食事（日別）"
          data={monthChartData}
          lines={[
            { key: 'steps', name: '歩数', color: '#10b981' },
            { key: 'meals', name: '食事数', color: '#f59e0b' },
          ]}
        />
      </section>
    </div>
  );
}
