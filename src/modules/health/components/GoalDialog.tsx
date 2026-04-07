import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
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
import { useCreateHealthGoal, useUpdateHealthGoal } from '../hooks/health.hooks';

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: any; // null for create
}

export function GoalDialog({ open, onOpenChange, goal }: GoalDialogProps) {
  const [formData, setFormData] = useState<any>({
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
      setFormData({ ...goal });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{goal ? '目標の編集' : '新しい目標の設定'}</DialogTitle>
          <DialogDescription>健康維持のための目標数値を設定します。</DialogDescription>
        </DialogHeader>

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
                <SelectItem value="daily_calorie_limit">摂取カロリー (上限)</SelectItem>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={createGoal.isPending || updateGoal.isPending}>
            {goal ? '更新' : '作成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
