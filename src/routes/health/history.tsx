import { createFileRoute } from '@tanstack/react-router';
import { format, subDays } from 'date-fns';
import { Edit2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RecordEditDialog } from '../../modules/health/components/RecordEditDialog';
import {
  useActivityRecords,
  useBloodGlucose,
  useBloodPressure,
  useDeleteBloodGlucose,
  useDeleteBloodPressure,
  useDeleteMeal,
  useMeals,
} from '../../modules/health/hooks/health.hooks';

type Tab = 'all' | 'bp' | 'glucose' | 'meals' | 'activity';

type TimelineRow =
  | { kind: 'bp'; id: string; at: string; label: string; sub: string }
  | { kind: 'glucose'; id: string; at: string; label: string; sub: string }
  | { kind: 'meal'; id: string; at: string; label: string; sub: string }
  | { kind: 'activity'; id: string; at: string; label: string; sub: string };

export const Route = createFileRoute('/health/history')({
  component: HealthHistory,
});

function HealthHistory() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const [editRecord, setEditRecord] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: bpRecords, isLoading: isBpLoading } = useBloodPressure(
    dateRange.from,
    dateRange.to
  );
  const { data: gRecords, isLoading: isGLoading } = useBloodGlucose(dateRange.from, dateRange.to);
  const { data: mealData, isLoading: isMealLoading } = useMeals(dateRange.from, dateRange.to);
  const { data: activityData, isLoading: isActLoading } = useActivityRecords(
    dateRange.from,
    dateRange.to
  );

  const deleteBp = useDeleteBloodPressure();
  const deleteGlucose = useDeleteBloodGlucose();
  const deleteMeal = useDeleteMeal();

  const timeline = useMemo(() => {
    const rows: TimelineRow[] = [];
    for (const r of bpRecords?.records ?? []) {
      rows.push({
        kind: 'bp',
        id: r.id,
        at: r.recordedAt,
        label: `${r.systolic} / ${r.diastolic} mmHg`,
        sub: `期間: ${r.period}`,
      });
    }
    for (const r of gRecords?.records ?? []) {
      rows.push({
        kind: 'glucose',
        id: r.id,
        at: r.recordedAt,
        label: `${r.value} ${r.unit}`,
        sub: `タイミング: ${r.timing}`,
      });
    }
    for (const r of mealData?.records ?? []) {
      rows.push({
        kind: 'meal',
        id: r.id,
        at: r.recordedAt,
        label: r.items.slice(0, 80) + (r.items.length > 80 ? '…' : ''),
        sub: r.estimatedCalories != null ? `約 ${r.estimatedCalories} kcal` : '',
      });
    }
    for (const r of activityData?.records ?? []) {
      const parts: string[] = [];
      if (r.steps != null) parts.push(`歩数 ${r.steps}`);
      if (r.activeMinutes != null) parts.push(`活動 ${r.activeMinutes} 分`);
      if (r.caloriesBurned != null) parts.push(`消費 ${r.caloriesBurned} kcal`);
      rows.push({
        kind: 'activity',
        id: r.id,
        at: r.recordedAt,
        label: parts.join(' · ') || '活動',
        sub: r.memo ?? '',
      });
    }
    rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return rows;
  }, [bpRecords, gRecords, mealData, activityData]);

  const handleDelete = async (row: TimelineRow) => {
    if (!window.confirm('この記録を削除してもよろしいですか？')) return;
    try {
      if (row.kind === 'bp') await deleteBp.mutateAsync(row.id);
      if (row.kind === 'glucose') await deleteGlucose.mutateAsync(row.id);
      if (row.kind === 'meal') await deleteMeal.mutateAsync(row.id);
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleEdit = (row: TimelineRow) => {
    // Find the full record object from the data
    let fullRecord = null;
    if (row.kind === 'bp') fullRecord = bpRecords?.records.find((r: any) => r.id === row.id);
    if (row.kind === 'glucose') fullRecord = gRecords?.records.find((r: any) => r.id === row.id);
    if (row.kind === 'meal') fullRecord = mealData?.records.find((r: any) => r.id === row.id);

    if (fullRecord) {
      setEditRecord({ ...fullRecord, kind: row.kind });
      setIsEditDialogOpen(true);
    }
  };

  const filtered = useMemo(() => {
    if (activeTab === 'all') return timeline;
    const map: Record<Tab, TimelineRow['kind'] | null> = {
      all: null,
      bp: 'bp',
      glucose: 'glucose',
      meals: 'meal',
      activity: 'activity',
    };
    const k = map[activeTab];
    return k ? timeline.filter((r) => r.kind === k) : timeline;
  }, [timeline, activeTab]);

  const loading = isBpLoading || isGLoading || isMealLoading || isActLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">履歴</h1>
          <p className="text-sm italic text-muted-foreground">
            血圧・血糖・食事・運動を日付順に表示します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="history-from" className="text-muted-foreground">
            開始
          </label>
          <input
            id="history-from"
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))}
            className="rounded-md border bg-background px-2 py-1"
          />
          <label htmlFor="history-to" className="text-muted-foreground">
            終了
          </label>
          <input
            id="history-to"
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))}
            className="rounded-md border bg-background px-2 py-1"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {(
          [
            ['all', 'すべて'],
            ['bp', '血圧'],
            ['glucose', '血糖'],
            ['meals', '食事'],
            ['activity', '運動'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 hover:bg-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card/40 backdrop-blur-sm">
        {loading ? (
          <p className="p-8 text-center text-muted-foreground">読み込み中…</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">日時</th>
                <th className="px-4 py-3">種類</th>
                <th className="px-4 py-3">内容</th>
                <th className="px-4 py-3">補足</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="hover:bg-muted/30 group">
                  <td className="whitespace-nowrap px-4 py-3">
                    {format(new Date(row.at), 'yyyy/MM/dd HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    {row.kind === 'bp' && '血圧'}
                    {row.kind === 'glucose' && '血糖'}
                    {row.kind === 'meal' && '食事'}
                    {row.kind === 'activity' && '運動'}
                  </td>
                  <td className="max-w-md px-4 py-3 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.sub}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {row.kind !== 'activity' && (
                        <>
                          <button
                            type="button"
                            className="p-1.5 hover:bg-black/5 rounded-md text-muted-foreground hover:text-primary transition-colors"
                            onClick={() => handleEdit(row)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 hover:bg-rose-50 rounded-md text-muted-foreground hover:text-rose-600 transition-colors"
                            onClick={() => handleDelete(row)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <p className="p-12 text-center italic text-muted-foreground">
            この期間に記録がありません。
          </p>
        )}
      </div>

      <RecordEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        record={editRecord}
      />
    </div>
  );
}
