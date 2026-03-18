export type NotificationChannel = 'BADGE' | 'EMAIL';

export interface PreferenceToggleInput {
  eventType: string;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface UserPreferences {
  eventType: string;
  badge: boolean;
  email: boolean;
}
