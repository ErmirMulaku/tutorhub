/**
 * Response and input shapes of the tutor API, ported from
 * apps/dashboard/src/store/api.ts. The status and level unions come from
 * @ermulaku/types (shared with the API) instead of being redeclared.
 */
import type { BookingStatus, Level } from '@ermulaku/types';

export interface MeTutor {
  id: string;
  name: string;
  headline: string | null;
}

// --- Bookings / lessons ------------------------------------------------------
export interface TutorStudent {
  id: string;
  fullName: string;
  avatarColor: string | null;
}
export interface TutorSubject {
  id: string;
  name: string;
  level: Level;
}
export interface TutorBooking {
  id: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  student: TutorStudent;
  subject: TutorSubject;
}
export interface TutorBookingsQuery {
  status?: BookingStatus;
  from?: string;
  to?: string;
}
export interface DashboardSummary {
  lessonsToday: number;
  earningsWeekCents: number;
  avgRating: number | null;
  reviewCount: number;
  pendingCount: number;
  unreadMessages: number;
}
export type StudentRef = TutorStudent;
export type SubjectRef = TutorSubject;
export interface CreateLessonInput {
  studentId: string;
  subjectId: string;
  startTime: string;
}
export interface TutorNotification {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  createdAt: string;
}

// --- Catalog -------------------------------------------------------------------
export type ServiceType = 'ONE_ON_ONE' | 'GROUP' | 'PACKAGE';
export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  level: Level;
  description: string | null;
  priceCents: number;
  durationMin: number;
  lessonsCount: number;
  isActive: boolean;
}
export interface CreateServiceInput {
  name: string;
  type: ServiceType;
  level: Level;
  description?: string;
  priceCents: number;
  durationMin: number;
  lessonsCount: number;
}

// --- Availability --------------------------------------------------------------
export interface WorkingHour {
  day: number;
  start: string;
  end: string;
}
export interface TimeOff {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}
export interface BookingRules {
  bufferMinutes: number;
  minNoticeHours: number;
  maxLessonsPerDay: number;
}
export interface MyAvailability extends BookingRules {
  workingHours: WorkingHour[];
  timeOff: TimeOff[];
}
export interface TimeOffInput {
  label: string;
  startDate: string;
  endDate: string;
}

// --- Messaging -----------------------------------------------------------------
export interface Conversation {
  id: string;
  studentName: string;
  studentAvatarColor: string | null;
  subjectName: string | null;
  lastMessageAt: string;
  preview: string | null;
  unread: number;
}
export interface ChatMessage {
  id: string;
  senderKind: 'TUTOR' | 'STUDENT';
  body: string;
  createdAt: string;
}

// --- Earnings ------------------------------------------------------------------
export type PayoutSchedule = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export interface EarningsSummary {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  payoutMethod: string | null;
  payoutSchedule: PayoutSchedule;
}
export interface MonthlyEarning {
  month: string;
  netCents: number;
}
export interface Transaction {
  id: string;
  date: string;
  studentName: string;
  subjectName: string;
  netCents: number;
  feeCents: number;
  status: string;
}
export interface ConnectStatus {
  onboarded: boolean;
  payoutsEnabled: boolean;
}

// --- Marketing -----------------------------------------------------------------
export type PromotionState = 'ACTIVE' | 'SCHEDULED' | 'ENDED';
export type DiscountType = 'PERCENT' | 'FIXED';
export interface Promotion {
  id: string;
  name: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  state: PromotionState;
  expiresAt: string | null;
  redemptions: number;
}
export interface MarketingSummary {
  activePromotions: number;
  redemptions: number;
  giftCardsSoldCents: number;
}
export interface ReferralProgram {
  creditCents: number;
  referredCount: number;
  issuedCents: number;
}
export interface CreatePromotionInput {
  name: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
}

// --- Reviews -------------------------------------------------------------------
export type ReviewFilter = 'all' | 'unreplied' | 'replied';
export interface TutorReview {
  id: string;
  studentName: string;
  studentAvatarColor: string | null;
  subjectName: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  createdAt: string;
}
export interface ReviewSummary {
  average: number;
  count: number;
  distribution: number[];
}

// --- Analytics -----------------------------------------------------------------
export interface AnalyticsSummary {
  lessonsThisMonth: number;
  newStudents: number;
  repeatRatePct: number;
  utilizationPct: number;
}
export interface MonthCount {
  month: string;
  count: number;
}
export interface SubjectShare {
  name: string;
  pct: number;
}
export interface DayCount {
  day: string;
  count: number;
}
export interface StudentMix {
  returningPct: number;
  newPct: number;
}

// --- Settings ------------------------------------------------------------------
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
export type TutorProfileInput = Partial<
  Pick<TutorSettings, 'name' | 'headline' | 'about' | 'timezone' | 'languages'>
>;
export type NotificationPrefsInput = Partial<
  Pick<
    TutorSettings,
    'notifyBookings' | 'notifyReminders' | 'notifyMessages' | 'notifyPayouts' | 'notifyTips'
  >
>;
