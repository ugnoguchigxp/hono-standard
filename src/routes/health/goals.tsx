import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
} from '@repo/design-system';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { GoalDialog } from '../../modules/health/components/GoalDialog';
import {
  useDeleteHealthGoal,
  useHealthGoals,
  useUpdateHealthGoal,
} from '../../modules/health/hooks/health.hooks';

export const Route = createFileRoute('/health/goals')({
  component: HealthGoals,
});

function HealthGoals() {
  const { data, isLoading } = useHealthGoals();
  const deleteGoal = useDeleteHealthGoal();
  const updateGoal = useUpdateHealthGoal();

  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAdd = () => {
    setSelectedGoal(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (goal: any) => {
    setSelectedGoal(goal);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この目標を削除してもよろしいですか？')) return;
    await deleteGoal.mutateAsync(id);
  };

  const handleToggleActive = async (goal: any) => {
    await updateGoal.mutateAsync({
      id: goal.id,
      input: { isActive: !goal.isActive },
    });
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">健康目標</h1>
          <p className="text-muted-foreground">日々の健康維持のための目標値を管理します。</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          新しい目標
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data?.records?.map((goal: any) => (
          <Card key={goal.id} className={goal.isActive ? 'border-primary/20' : 'opacity-70'}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-full p-2 ${goal.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                  >
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{getGoalLabel(goal.goalType)}</CardTitle>
                    <CardDescription>
                      {goal.startsOn} 〜 {goal.endsOn || '継続中'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Switch
                    checked={goal.isActive}
                    onCheckedChange={() => handleToggleActive(goal)}
                  />
                  <Badge variant={goal.isActive ? 'default' : 'secondary'}>
                    {goal.isActive ? 'アクティブ' : '非アクティブ'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-muted-foreground italic">Target: </span>
                  <span className="font-bold">
                    {goal.targetValue ?? `${goal.targetMin} - ${goal.targetMax}`}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(goal)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                    onClick={() => handleDelete(goal.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {goal.memo && (
                <p className="mt-3 text-xs text-muted-foreground line-clamp-2 italic">
                  &ldquo;{goal.memo}&rdquo;
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {data?.records?.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20">
          <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">目標が設定されていません。</p>
          <Button variant="link" onClick={handleAdd}>
            最初の目標を作成する
          </Button>
        </div>
      )}

      <GoalDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} goal={selectedGoal} />
    </div>
  );
}

function getGoalLabel(type: string): string {
  const labels: Record<string, string> = {
    daily_step_count: '1日の歩数',
    blood_pressure_systolic_max: '最高血圧 (上限)',
    blood_pressure_diastolic_max: '最低血圧 (上限)',
    blood_glucose_fasting_range: '空腹時血糖 (範囲)',
    blood_glucose_postprandial_range: '食後血糖 (範囲)',
    daily_calorie_limit: '摂取カロリー (上限)',
    weekly_exercise_days: '週の運動日数',
  };
  return labels[type] || type;
}
