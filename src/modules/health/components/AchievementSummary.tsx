import { Badge, Card, CardContent, CardHeader, CardTitle, ProgressBar } from '@repo/design-system';
import { CheckCircle2, Circle, Target } from 'lucide-react';
import type { AchievementItem } from '../../../types/health.types';
import { useHealthGoalAchievements } from '../hooks/health.hooks';

export function AchievementSummary() {
  const { data, isLoading } = useHealthGoalAchievements();

  if (isLoading) return <div className="h-48 animate-pulse bg-muted rounded-xl" />;
  if (!data?.items?.length) return null;

  return (
    <Card className="border-none shadow-none bg-accent/5 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
            目標の達成状況
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.items.map((item: AchievementItem) => (
          <div key={item.goal.id} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {item.achieved ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/30" />
                )}
                <span className="text-sm font-medium">{getGoalLabel(item.goal.goalType)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-muted-foreground italic">
                  {Math.round(item.achievementRate)}%
                </span>
                {item.achieved && (
                  <Badge
                    variant="outline"
                    className="h-5 px-1.5 py-0 border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] uppercase font-bold tracking-tighter"
                  >
                    Done
                  </Badge>
                )}
              </div>
            </div>
            <ProgressBar value={item.achievementRate} className="h-1.5" />
            {item.details && (
              <p className="text-[10px] text-muted-foreground/60 italic lowercase">
                {item.details}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function getGoalLabel(type: string): string {
  const labels: Record<string, string> = {
    daily_step_count: '1日の歩数',
    blood_pressure_systolic_max: '最高血圧 (上限)',
    blood_pressure_diastolic_max: '最低血圧 (上限)',
    blood_glucose_fasting_range: '空腹時血糖 (範囲)',
    blood_glucose_postprandial_range: '食後血糖 (範囲)',
    daily_calorie_limit: '1日トータル摂取カロリー (上限)',
    weekly_exercise_days: '週の運動日数',
  };
  return labels[type] || type;
}
