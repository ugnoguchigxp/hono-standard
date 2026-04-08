import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { healthRpc } from '../../../lib/health-rpc';

/** ブラウザのローカルタイムゾーン（API の日付境界用） */
export const browserTimeZone = (): string | undefined =>
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

export function useDailySummary(date?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'daily-summary', date, tz],
    queryFn: async () => {
      const res = await healthRpc.summary.daily.$get({
        query: { date, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch daily summary');
      return res.json();
    },
  });
}

export function useWeeklySummary(weekStart: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'weekly-summary', weekStart, tz],
    queryFn: async () => {
      const res = await healthRpc.summary.weekly.$get({
        query: { weekStart, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch weekly summary');
      return res.json();
    },
  });
}

export function useMonthlySummary(yearMonth: string) {
  return useQuery({
    queryKey: ['health', 'monthly-summary', yearMonth],
    queryFn: async () => {
      const res = await healthRpc.summary.monthly.$get({
        query: { yearMonth },
      });
      if (!res.ok) throw new Error('Failed to fetch monthly summary');
      return res.json();
    },
  });
}

export function useBloodPressure(from?: string, to?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'blood-pressure', from, to, tz],
    queryFn: async () => {
      const res = await healthRpc.vitals['blood-pressure'].$get({
        query: { from, to, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch blood pressure records');
      return res.json();
    },
  });
}

export function useBloodGlucose(from?: string, to?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'blood-glucose', from, to, tz],
    queryFn: async () => {
      const res = await healthRpc.vitals['blood-glucose'].$get({
        query: { from, to, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch blood glucose records');
      return res.json();
    },
  });
}

export function useMeals(from?: string, to?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'meals', from, to, tz],
    queryFn: async () => {
      const res = await healthRpc.nutrition.meals.$get({
        query: { from, to, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch meals');
      return res.json();
    },
  });
}

export function useWeights(from?: string, to?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'weights', from, to, tz],
    queryFn: async () => {
      const res = await healthRpc.vitals.weight.$get({
        query: { from, to, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch weight records');
      return res.json();
    },
  });
}

export function useActivityRecords(from?: string, to?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'activity-records', from, to, tz],
    queryFn: async () => {
      const res = await healthRpc.activity.records.$get({
        query: { from, to, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch activity records');
      return res.json();
    },
  });
}

// --- Mutations ---

export function useCreateBloodPressure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const res = await healthRpc.vitals['blood-pressure'].$post({
        json: input,
      });
      if (!res.ok) throw new Error('Failed to create blood pressure record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useCreateBloodGlucose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const res = await healthRpc.vitals['blood-glucose'].$post({
        json: input,
      });
      if (!res.ok) throw new Error('Failed to create blood glucose record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useUpdateBloodPressure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Record<string, unknown> }) => {
      const res = await healthRpc.vitals['blood-pressure'][':id'].$put({
        param: { id },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update blood pressure record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useDeleteBloodPressure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await healthRpc.vitals['blood-pressure'][':id'].$delete({
        param: { id },
      });
      if (!res.ok) throw new Error('Failed to delete blood pressure record');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useUpdateBloodGlucose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Record<string, unknown> }) => {
      const res = await healthRpc.vitals['blood-glucose'][':id'].$put({
        param: { id },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update blood glucose record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useDeleteBloodGlucose() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await healthRpc.vitals['blood-glucose'][':id'].$delete({
        param: { id },
      });
      if (!res.ok) throw new Error('Failed to delete blood glucose record');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useCreateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const res = await healthRpc.nutrition.meals.$post({
        json: input,
      });
      if (!res.ok) throw new Error('Failed to create meal record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useUpdateMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Record<string, unknown> }) => {
      const res = await healthRpc.nutrition.meals[':id'].$put({
        param: { id },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update meal record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useCreateWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const res = await healthRpc.vitals.weight.$post({
        json: input,
      });
      if (!res.ok) throw new Error('Failed to create weight record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useUpdateWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Record<string, unknown> }) => {
      const res = await healthRpc.vitals.weight[':id'].$put({
        param: { id },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update weight record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useDeleteWeight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await healthRpc.vitals.weight[':id'].$delete({
        param: { id },
      });
      if (!res.ok) throw new Error('Failed to delete weight record');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await healthRpc.nutrition.meals[':id'].$delete({
        param: { id },
      });
      if (!res.ok) throw new Error('Failed to delete meal record');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
    },
  });
}

export function useHealthGoalAchievements(asOfDate?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'goal-achievements', asOfDate, tz],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await healthRpc.goals.achievements.$get({
        query: { asOfDate, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch goal achievements');
      return res.json();
    },
  });
}

export function useHealthAlerts(isRead?: boolean, limit?: number) {
  return useQuery({
    queryKey: ['health', 'alerts', isRead, limit],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await healthRpc.alerts.$get({
        query: { isRead, limit },
      });
      if (!res.ok) throw new Error('Failed to fetch health alerts');
      return res.json();
    },
  });
}

export function useMarkHealthAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await healthRpc.alerts[':id'].read.$put({
        param: { id },
      });
      if (!res.ok) throw new Error('Failed to mark health alert as read');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'alerts'] });
    },
  });
}

export function useWeeklyHealthReport(weekStart?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'weekly-report', weekStart, tz],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await healthRpc.reports.weekly.$get({
        query: { weekStart, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to fetch weekly report');
      return res.json();
    },
  });
}

export function useReminderSettings() {
  return useQuery({
    queryKey: ['health', 'reminder-settings'],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await healthRpc.reminders.settings.$get();
      if (!res.ok) throw new Error('Failed to fetch reminder settings');
      return res.json();
    },
  });
}

export function useHealthProfile() {
  return useQuery({
    queryKey: ['health', 'profile'],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await healthRpc.profile.$get();
      if (!res.ok) throw new Error('Failed to fetch health profile');
      return res.json();
    },
  });
}

export function useUpdateHealthProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const res = await healthRpc.profile.$put({
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update health profile');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'weights'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'goal-achievements'] });
    },
  });
}

export function useUpdateReminderSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reminderType,
      input,
    }: {
      reminderType: string;
      input: Record<string, unknown>;
    }) => {
      const res = await healthRpc.reminders.settings[':reminderType'].$put({
        param: { reminderType },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update reminder setting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'reminder-settings'] });
    },
  });
}

export function useExportHealthData(format: 'json' | 'csv' = 'json', from?: string, to?: string) {
  const tz = browserTimeZone();
  return useQuery({
    queryKey: ['health', 'export', format, from, to, tz],
    queryFn: async () => {
      const res = await healthRpc.export.$get({
        query: { format, from, to, timeZone: tz },
      });
      if (!res.ok) throw new Error('Failed to export health data');
      return res.json();
    },
  });
}

export function useHealthGoals() {
  return useQuery({
    queryKey: ['health', 'goals'],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await healthRpc.goals.$get();
      if (!res.ok) throw new Error('Failed to fetch health goals');
      return res.json();
    },
  });
}

export function useCreateHealthGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const res = await healthRpc.goals.$post({
        json: input,
      });
      if (!res.ok) throw new Error('Failed to create health goal');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'goal-achievements'] });
    },
  });
}

export function useUpdateHealthGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Record<string, unknown> }) => {
      const res = await healthRpc.goals[':id'].$put({
        param: { id },
        json: input,
      });
      if (!res.ok) throw new Error('Failed to update health goal');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'goal-achievements'] });
    },
  });
}

export function useDeleteHealthGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await healthRpc.goals[':id'].$delete({
        param: { id },
      });
      if (!res.ok) throw new Error('Failed to delete health goal');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health', 'goals'] });
      queryClient.invalidateQueries({ queryKey: ['health', 'goal-achievements'] });
    },
  });
}
