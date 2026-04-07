import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@repo/design-system';
import { createFileRoute } from '@tanstack/react-router';
import { format, startOfWeek } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Calendar, FileText, Minus, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { useWeeklyHealthReport } from '../../modules/health/hooks/health.hooks';

export const Route = createFileRoute('/health/reports')({
  component: HealthReports,
});

function HealthReports() {
  const [targetDate, setTargetDate] = useState(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const { data, isLoading } = useWeeklyHealthReport(targetDate);

  if (isLoading) return <div className="p-8 text-center animate-pulse">読み込み中...</div>;

  const report = data?.report;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">週次レポート</h1>
          <p className="text-muted-foreground">週間累計データと健康状態の要約を確認します。</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            className="w-auto h-9"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
      </div>

      {!report ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20">
          <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">レポートがまだ生成されていません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Summary Card */}
          <Card className="col-span-full border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>今週のサマリ</CardTitle>
              </div>
              <CardDescription>
                {report.weekStart} 〜 {report.weekEnd}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-medium leading-relaxed italic text-primary/80">
                &ldquo;{report.summary || 'データ収集中です。'}&rdquo;
              </p>
            </CardContent>
          </Card>

          {/* Steps Detail */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>週間歩数</CardDescription>
              <CardTitle className="text-2xl font-bold">
                {report.stepsTotal.toLocaleString()} 歩
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {report.stepsDelta > 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                ) : report.stepsDelta < 0 ? (
                  <ArrowDownRight className="h-4 w-4 text-rose-500" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )}
                <span
                  className={`text-sm font-bold ${report.stepsDelta > 0 ? 'text-emerald-600' : report.stepsDelta < 0 ? 'text-rose-600' : 'text-muted-foreground'}`}
                >
                  先週比 {Math.abs(report.stepsDelta).toLocaleString()} 歩
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                1日平均 {Math.round(report.avgSteps).toLocaleString()} 歩
              </p>
            </CardContent>
          </Card>

          {/* Vitals Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>平均血圧</CardDescription>
              <CardTitle className="text-2xl font-bold">
                {report.avgSystolic
                  ? `${Math.round(report.avgSystolic)}/${Math.round(report.avgDiastolic || 0)}`
                  : '—'}
                <span className="ml-1 text-sm font-normal text-muted-foreground">mmHg</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                サンプル数: {report.bloodPressureSampleCount} 件
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">平均空腹時血糖:</span>
                  <span className="font-medium text-amber-600">
                    {report.avgFastingGlucose
                      ? `${Math.round(report.avgFastingGlucose)} mg/dL`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">平均食後血糖:</span>
                  <span className="font-medium text-amber-600">
                    {report.avgPostprandialGlucose
                      ? `${Math.round(report.avgPostprandialGlucose)} mg/dL`
                      : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Achievement Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>目標達成率 (平均)</CardDescription>
              <CardTitle className="text-2xl font-bold">
                {report.goalAchievementRateAverage != null
                  ? `${Math.round(report.goalAchievementRateAverage)}%`
                  : '—'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">設定中の指標: {report.goalCount} 個</p>
              <div className="mt-4 flex flex-col gap-2">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${report.goalAchievementRateAverage || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
