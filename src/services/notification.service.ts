/**
 * Notification service – config and helpers for the notifications feature.
 * Notifications are created server-side (edge functions, triggers). This module
 * exposes shared types and optional client helpers.
 */

import type { NotificationType } from '@/hooks/useNotifications';

export type { NotificationType };

/** Category slugs used in notification_preferences.categories */
export const NOTIFICATION_CATEGORIES = [
  'earnings',
  'engagement',
  'promotions',
  'system',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Map notification type to preference category */
export const NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategory> = {
  engagement: 'engagement',
  promotion: 'promotions',
  system: 'system',
  earnings: 'earnings',
};

/** Default limit for notification list fetch */
export const DEFAULT_NOTIFICATION_PAGE_SIZE = 30;

/** Call the send-notification-email edge function (requires auth). Used by backend or admin flows. */
export async function sendNotificationViaEdge(
  supabaseUrl: string,
  accessToken: string,
  payload: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }
): Promise<{ success: boolean; notification?: { id: string }; skipped?: boolean; error?: string }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error ?? res.statusText };
  }
  return data;
}
