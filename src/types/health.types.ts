// Health-related types for components

export interface HealthGoal {
  id: string;
  userId: string;
  goalType: string;
  targetValue: number;
  targetMin?: number;
  targetMax?: number;
  currentValue: number | null;
  isActive: boolean;
  startDate: string;
  startsOn?: string;
  endDate: string | null;
  endsOn?: string;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderSetting {
  id: string;
  userId: string;
  reminderType: 'blood_pressure' | 'blood_glucose' | 'meal';
  isEnabled: boolean;
  localTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthAlert {
  id: string;
  userId: string;
  alertType: string;
  severity: string;
  title?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface HealthProfile {
  id: string;
  userId: string;
  age: number | null;
  gender: 'male' | 'female' | null;
  heightCm: number | null;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null;
  latestWeightKg: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AchievementItem {
  goal: HealthGoal;
  progress: number;
  achieved: boolean;
  achievementRate: number;
  details?: string;
}

export interface HealthTrendData {
  date: string;
  [key: string]: number | string;
}
