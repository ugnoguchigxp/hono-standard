import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/design-system';
import { createFileRoute } from '@tanstack/react-router';
import { format } from 'date-fns';
import { AlertCircle, AlertTriangle, Bell, Check, Clock, Info } from 'lucide-react';
import { useHealthAlerts, useMarkHealthAlertRead } from '../../modules/health/hooks/health.hooks';
import type { HealthAlert } from '../../types/health.types';

export const Route = createFileRoute('/health/alerts')({
  component: HealthAlerts,
});

function HealthAlerts() {
  const { data, isLoading } = useHealthAlerts();
  const markRead = useMarkHealthAlertRead();

  const handleMarkRead = async (id: string) => {
    await markRead.mutateAsync(id);
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">読み込み中...</div>;

  const records = (data?.records ?? []) as HealthAlert[];
  const unreadCount = records.filter((r) => !r.isRead).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">アラート</h1>
          <p className="text-muted-foreground">健康指標の異常傾向や重要な通知を確認します。</p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="animate-bounce">
            {unreadCount} 件の未読
          </Badge>
        )}
      </div>

      <div className="space-y-4">
        {records.map((alert) => (
          <Card
            key={alert.id}
            className={alert.isRead ? 'opacity-60 grayscale-[0.5]' : 'border-l-4 border-l-primary'}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${getSeverityColor(alert.severity)}`}>
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{alert.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(alert.createdAt), 'yyyy/MM/dd HH:mm')}
                    </CardDescription>
                  </div>
                </div>
                {!alert.isRead && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkRead(alert.id)}
                    disabled={markRead.isPending}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    既読にする
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-balance">{alert.message}</p>
              {alert.isRead && (
                <p className="mt-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  READ
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {records.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20">
          <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">現在アラートはありません。健康状態は良好です！</p>
        </div>
      )}
    </div>
  );
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'info':
      return <Info className="h-4 w-4" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4" />;
    case 'critical':
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'info':
      return 'bg-blue-100 text-blue-700';
    case 'warning':
      return 'bg-amber-100 text-amber-700';
    case 'critical':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
