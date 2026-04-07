import { refreshHealthAlertsForDate } from './health-alerts.service';
import { refreshWeeklyReportForDate } from './health-reports.service';

export const refreshHealthInsightsForDate = async (
  userId: string,
  date: string,
  timeZone?: string | null
) => {
  const [alerts, report] = await Promise.all([
    refreshHealthAlertsForDate(userId, date, timeZone),
    refreshWeeklyReportForDate(userId, date, timeZone),
  ]);

  return {
    alerts,
    report,
  };
};
