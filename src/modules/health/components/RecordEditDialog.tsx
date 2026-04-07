import { Button } from '@repo/design-system/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/design-system/components/ui/dialog';
import { Input } from '@repo/design-system/components/ui/input';
import { Label } from '@repo/design-system/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/design-system/components/ui/select';
import { Textarea } from '@repo/design-system/components/ui/textarea';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import {
  useUpdateBloodGlucose,
  useUpdateBloodPressure,
  useUpdateMeal,
} from '../hooks/health.hooks';

interface RecordEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: any; // Simplified for this implementation
}

export function RecordEditDialog({ open, onOpenChange, record }: RecordEditDialogProps) {
  const [formData, setFormData] = useState<any>({});

  const updateBp = useUpdateBloodPressure();
  const updateGlucose = useUpdateBloodGlucose();
  const updateMeal = useUpdateMeal();

  useEffect(() => {
    if (record) {
      setFormData({ ...record });
    }
  }, [record]);

  const handleSave = async () => {
    try {
      if (record.kind === 'bp') {
        await updateBp.mutateAsync({
          id: record.id,
          input: {
            recordedAt: formData.recordedAt,
            systolic: Number(formData.systolic),
            diastolic: Number(formData.diastolic),
            pulse: formData.pulse ? Number(formData.pulse) : undefined,
            period: formData.period,
            memo: formData.memo,
          },
        });
      } else if (record.kind === 'glucose') {
        await updateGlucose.mutateAsync({
          id: record.id,
          input: {
            recordedAt: formData.recordedAt,
            value: Number(formData.value),
            unit: formData.unit,
            timing: formData.timing,
            memo: formData.memo,
          },
        });
      } else if (record.kind === 'meal') {
        await updateMeal.mutateAsync({
          id: record.id,
          input: {
            recordedAt: formData.recordedAt,
            items: formData.items,
            estimatedCalories: formData.estimatedCalories
              ? Number(formData.estimatedCalories)
              : undefined,
            memo: formData.memo,
          },
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save record:', error);
    }
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>記録の編集</DialogTitle>
          <DialogDescription>健康記録の内容を修正します。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Common Field: Date (Readonly for now as per simplicity or editable) */}
          <div className="grid gap-2">
            <Label htmlFor="date">日時</Label>
            <Input
              id="date"
              type="datetime-local"
              value={
                formData.recordedAt
                  ? format(new Date(formData.recordedAt), "yyyy-MM-dd'T'HH:mm")
                  : ''
              }
              onChange={(e) =>
                setFormData({ ...formData, recordedAt: new Date(e.target.value).toISOString() })
              }
            />
          </div>

          {record.kind === 'bp' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="systolic">最高血圧 (mmHg)</Label>
                  <Input
                    id="systolic"
                    type="number"
                    value={formData.systolic || ''}
                    onChange={(e) => setFormData({ ...formData, systolic: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="diastolic">最低血圧 (mmHg)</Label>
                  <Input
                    id="diastolic"
                    type="number"
                    value={formData.diastolic || ''}
                    onChange={(e) => setFormData({ ...formData, diastolic: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="period">時間帯</Label>
                <Select
                  value={formData.period}
                  onValueChange={(v) => setFormData({ ...formData, period: v })}
                >
                  <SelectTrigger>
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

          {record.kind === 'glucose' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="value">血糖値 ({formData.unit})</Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value || ''}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timing">タイミング</Label>
                <Select
                  value={formData.timing}
                  onValueChange={(v) => setFormData({ ...formData, timing: v })}
                >
                  <SelectTrigger>
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

          {record.kind === 'meal' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="items">内容</Label>
                <Textarea
                  id="items"
                  value={formData.label || ''}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="何を食べましたか？"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calories">推定カロリー (kcal)</Label>
                <Input
                  id="calories"
                  type="number"
                  value={formData.estimatedCalories || ''}
                  onChange={(e) => setFormData({ ...formData, estimatedCalories: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="memo">メモ</Label>
            <Textarea
              id="memo"
              value={formData.memo || ''}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateBp.isPending || updateGlucose.isPending || updateMeal.isPending}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
