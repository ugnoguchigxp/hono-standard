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
  Switch,
} from '@repo/design-system';
import { createFileRoute } from '@tanstack/react-router';
import { format, subDays } from 'date-fns';
import { Bell, Clock, Download, FileJson, FileSpreadsheet, Settings } from 'lucide-react';
import { useState } from 'react';
import { DesignSettings } from '../../components/DesignSettings';
import { healthRpc } from '../../lib/health-rpc';
import {
  useHealthAlerts,
  useReminderSettings,
  useUpdateReminderSetting,
  useWeeklyHealthReport,
} from '../../modules/health/hooks/health.hooks';

export const Route = createFileRoute('/health/settings')({
  component: HealthSettings,
});

function HealthSettings() {
  const { data: reminderData, isLoading: isReminderLoading } = useReminderSettings();
  const updateReminder = useUpdateReminderSetting();
  const { data: alertsData } = useHealthAlerts(true, 3);
  const { data: reportData } = useWeeklyHealthReport(format(subDays(new Date(), 7), 'yyyy-MM-dd'));

  const [exportRange, setExportRange] = useState({
    from: format(subDays(new Date(), 90), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
    format: 'json' as 'json' | 'csv',
  });

  const handleUpdateReminder = async (type: string, enabled: boolean, time?: string) => {
    await updateReminder.mutateAsync({
      reminderType: type,
      input: {
        isEnabled: enabled,
        localTime:
          time ||
          reminderData?.records.find((r: any) => r.reminderType === type)?.localTime ||
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

  if (isReminderLoading) return <div className="p-8 text-center animate-pulse">読み込み中...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">設定・管理</h1>
        <p className="text-muted-foreground">リマインド設定とデータの管理を行います。</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Reminders Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">リマインド設定</h2>
          </div>

          <div className="space-y-3">
            {['blood_pressure', 'blood_glucose', 'meal'].map((type) => {
              const setting = reminderData?.records.find((r: any) => r.reminderType === type);
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

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">現在の状態</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">未読アラート</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {(alertsData?.records ?? []).length} 件
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">今週のレポート</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {reportData?.report?.summary || 'レポート生成待ち'}
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Design Settings Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">表示・デザイン</h2>
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
            <h2 className="text-lg font-semibold">データエクスポート</h2>
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
                    <FileJson className="mr-2 h-3.5 w-3.5" />
                    JSON
                  </Button>
                  <Button
                    variant={exportRange.format === 'csv' ? 'default' : 'outline'}
                    className="flex-1 text-xs"
                    onClick={() => setExportRange({ ...exportRange, format: 'csv' })}
                  >
                    <FileSpreadsheet className="mr-2 h-3.5 w-3.5" />
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
