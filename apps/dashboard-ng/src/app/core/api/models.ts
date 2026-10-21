/**
 * Response shapes of the tutor GraphQL API, ported from
 * apps/dashboard/src/store/api.ts. Domain enums come from @ermulaku/types.
 * Grows feature by feature (Phase 3 adds the rest).
 */

export interface MeTutor {
  id: string;
  name: string;
  headline: string | null;
}

export interface TutorSettings {
  name: string;
  headline: string | null;
  about: string | null;
  timezone: string;
  languages: string[];
  isActive: boolean;
  notifyBookings: boolean;
  notifyReminders: boolean;
  notifyMessages: boolean;
  notifyPayouts: boolean;
  notifyTips: boolean;
}
