import type { Level } from '@ermulaku/types';
import { API_URL } from './env';
import { graphqlRequest } from './graphql';

/** A subject as returned for storefront listings. */
export interface DiscoverSubject {
  id: string;
  name: string;
  level: Level;
}

/** A tutor card's worth of data from the `tutors` query. */
export interface DiscoverTutor {
  id: string;
  name: string;
  bio: string | null;
  headline: string | null;
  hourlyCents: number;
  rating: number | null;
  reviewCount: number;
  timezone: string;
  avatarColor: string | null;
  languages: string[];
  badges: string[];
  responseTime: string | null;
  totalLessons: number;
  subjects: DiscoverSubject[];
}

/** Selection set shared by the discover grid and profile queries. */
const TUTOR_FIELDS = /* GraphQL */ `
  id
  name
  bio
  headline
  hourlyCents
  rating
  reviewCount
  timezone
  avatarColor
  languages
  badges
  responseTime
  totalLessons
  subjects {
    id
    name
    level
  }
`;

export interface TutorPage {
  total: number;
  hasMore: boolean;
  items: DiscoverTutor[];
}

const TUTORS_QUERY = /* GraphQL */ `
  query Discover(
    $subject: String
    $query: String
    $level: Level
    $maxPrice: Int
    $minRating: Float
    $sort: String
    $limit: Int!
    $offset: Int!
  ) {
    tutors(
      subject: $subject
      query: $query
      level: $level
      maxPrice: $maxPrice
      minRating: $minRating
      sort: $sort
      limit: $limit
      offset: $offset
    ) {
      total
      hasMore
      items {
        ${TUTOR_FIELDS}
      }
    }
  }
`;

/** A review shown on a tutor profile. */
export interface TutorReview {
  id: string;
  rating: number;
  comment: string | null;
}

/** Full tutor detail for the profile page. */
export interface ProfileTutor extends DiscoverTutor {
  reviews: TutorReview[];
}

/** A bookable time slot from the availability engine (ISO-8601 UTC instants). */
export interface Slot {
  start: string;
  end: string;
}

const TUTOR_QUERY = /* GraphQL */ `
  query Tutor($id: ID!) {
    tutor(id: $id) {
      ${TUTOR_FIELDS}
      reviews {
        id
        rating
        comment
      }
    }
  }
`;

const AVAILABILITY_QUERY = /* GraphQL */ `
  query Availability($tutorId: ID!, $date: String!) {
    availability(tutorId: $tutorId, date: $date) {
      start
      end
    }
  }
`;

/** SSR fetch for a single tutor profile; `null` when the id is unknown. */
export async function getTutor(id: string): Promise<ProfileTutor | null> {
  const data = await graphqlRequest<{ tutor: ProfileTutor | null }>(TUTOR_QUERY, {
    variables: { id },
    next: { revalidate: 60 },
  });
  return data.tutor;
}

/** Availability for a tutor on a given `YYYY-MM-DD` date. Always fresh. */
export async function getAvailability(tutorId: string, date: string): Promise<Slot[]> {
  const data = await graphqlRequest<{ availability: Slot[] }>(AVAILABILITY_QUERY, {
    variables: { tutorId, date },
    cache: 'no-store',
  });
  return data.availability;
}

export interface BookLessonInput {
  tutorId: string;
  subjectId: string;
  /** Lesson start as an ISO-8601 UTC instant (a slot's `start`). */
  startTime: string;
}

const BOOK_LESSON_MUTATION = /* GraphQL */ `
  mutation Book($input: BookInput!) {
    bookLesson(input: $input) {
      id
      status
    }
  }
`;

/** Authenticated booking mutation; `token` is a student JWT. */
export async function bookLesson(
  input: BookLessonInput,
  token: string,
): Promise<{ id: string; status: string }> {
  const data = await graphqlRequest<{ bookLesson: { id: string; status: string } }>(
    BOOK_LESSON_MUTATION,
    { variables: { input }, token, cache: 'no-store' },
  );
  return data.bookLesson;
}

const CREATE_LESSON_PAYMENT_INTENT_MUTATION = /* GraphQL */ `
  mutation CreateLessonPaymentIntent($input: BookInput!) {
    createLessonPaymentIntent(input: $input) {
      clientSecret
      bookingId
      paymentId
    }
  }
`;

export interface LessonPaymentIntent {
  clientSecret: string;
  bookingId: string;
  paymentId: string;
}

/**
 * Authenticated paid booking: creates the booking (PENDING) plus a Stripe
 * PaymentIntent; the client confirms the card with `clientSecret` and the
 * webhook flips the booking to CONFIRMED.
 */
export async function createLessonPaymentIntent(
  input: BookLessonInput,
  token: string,
): Promise<LessonPaymentIntent> {
  const data = await graphqlRequest<{ createLessonPaymentIntent: LessonPaymentIntent }>(
    CREATE_LESSON_PAYMENT_INTENT_MUTATION,
    { variables: { input }, token, cache: 'no-store' },
  );
  return data.createLessonPaymentIntent;
}

export type TutorSort = 'relevance' | 'priceAsc' | 'priceDesc' | 'rating';

export interface GetTutorsArgs {
  subject?: string | undefined;
  query?: string | undefined;
  level?: Level | undefined;
  maxPrice?: number | undefined;
  minRating?: number | undefined;
  sort?: TutorSort | undefined;
  limit?: number;
  offset?: number;
}

/** SSR fetch for the discover/search grid. Listings revalidate every 60s. */
export async function getTutors({
  subject,
  query,
  level,
  maxPrice,
  minRating,
  sort,
  limit = 24,
  offset = 0,
}: GetTutorsArgs): Promise<TutorPage> {
  const data = await graphqlRequest<{ tutors: TutorPage }>(TUTORS_QUERY, {
    variables: {
      subject: subject ?? null,
      query: query ?? null,
      level: level ?? null,
      maxPrice: maxPrice ?? null,
      minRating: minRating ?? null,
      sort: sort ?? null,
      limit,
      offset,
    },
    next: { revalidate: 60 },
  });
  return data.tutors;
}

/* ---- Authenticated student data ----------------------------------------- */

export interface StudentMe {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarColor: string | null;
  walletCents: number;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyReminders: boolean;
  notifyPromos: boolean;
  twoFactorEnabled: boolean;
}

const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      id
      fullName
      email
      phone
      avatarColor
      walletCents
      notifyEmail
      notifySms
      notifyReminders
      notifyPromos
      twoFactorEnabled
    }
  }
`;

export async function getMe(token: string): Promise<StudentMe | null> {
  try {
    const data = await graphqlRequest<{ me: StudentMe }>(ME_QUERY, {
      token,
      cache: 'no-store',
    });
    return data.me;
  } catch {
    return null;
  }
}

export interface BookingTutorRef {
  id: string;
  name: string;
  avatarColor: string | null;
  timezone: string;
  hourlyCents: number;
}

export interface MyBooking {
  id: string;
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  tutor: BookingTutorRef;
  subject: { id: string; name: string; level: Level };
}

const MY_BOOKINGS_QUERY = /* GraphQL */ `
  query MyBookings {
    myBookings {
      id
      startTime
      endTime
      status
      tutor {
        id
        name
        avatarColor
        timezone
        hourlyCents
      }
      subject {
        id
        name
        level
      }
    }
  }
`;

export async function getMyBookings(token: string): Promise<MyBooking[]> {
  const data = await graphqlRequest<{ myBookings: MyBooking[] }>(MY_BOOKINGS_QUERY, {
    token,
    cache: 'no-store',
  });
  return data.myBookings;
}

const MY_FAVORITES_QUERY = /* GraphQL */ `
  query MyFavorites {
    myFavorites {
      ${TUTOR_FIELDS}
    }
  }
`;

export async function getMyFavorites(token: string): Promise<DiscoverTutor[]> {
  const data = await graphqlRequest<{ myFavorites: DiscoverTutor[] }>(MY_FAVORITES_QUERY, {
    token,
    cache: 'no-store',
  });
  return data.myFavorites;
}

const MY_FAVORITE_IDS_QUERY = /* GraphQL */ `
  query MyFavoriteIds {
    myFavoriteIds
  }
`;

export async function getMyFavoriteIds(token: string): Promise<string[]> {
  try {
    const data = await graphqlRequest<{ myFavoriteIds: string[] }>(MY_FAVORITE_IDS_QUERY, {
      token,
      cache: 'no-store',
    });
    return data.myFavoriteIds;
  } catch {
    return [];
  }
}

export interface GiftCard {
  id: string;
  code: string;
  amountCents: number;
  balanceCents: number;
  design: number;
  fromName: string | null;
  toName: string | null;
  message: string | null;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface Wallet {
  balanceCents: number;
  giftCards: GiftCard[];
  paymentMethods: PaymentMethod[];
}

const WALLET_QUERY = /* GraphQL */ `
  query Wallet {
    wallet {
      balanceCents
      giftCards {
        id
        code
        amountCents
        balanceCents
        design
        fromName
        toName
        message
        createdAt
      }
      paymentMethods {
        id
        brand
        last4
        expMonth
        expYear
      }
    }
  }
`;

export async function getWallet(token: string): Promise<Wallet> {
  const data = await graphqlRequest<{ wallet: Wallet }>(WALLET_QUERY, {
    token,
    cache: 'no-store',
  });
  return data.wallet;
}

/* ---- Notifications ------------------------------------------------------- */

export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'LESSON_REMINDER'
  | 'REVIEW_PROMPT'
  | 'GIFT_RECEIVED';

export interface Notification {
  id: string;
  type: NotificationType;
  actorName: string | null;
  detail: string | null;
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_QUERY = /* GraphQL */ `
  query Notifications {
    unreadNotificationCount
    notifications {
      id
      type
      actorName
      detail
      read
      createdAt
    }
  }
`;

export interface NotificationFeed {
  items: Notification[];
  unread: number;
}

export async function getNotifications(token: string): Promise<NotificationFeed> {
  try {
    const data = await graphqlRequest<{
      unreadNotificationCount: number;
      notifications: Notification[];
    }>(NOTIFICATIONS_QUERY, { token, cache: 'no-store' });
    return { items: data.notifications, unread: data.unreadNotificationCount };
  } catch {
    return { items: [], unread: 0 };
  }
}

const MARK_ALL_READ_MUTATION = /* GraphQL */ `
  mutation MarkAllRead {
    markAllNotificationsRead {
      id
    }
  }
`;

export async function markAllNotificationsRead(token: string): Promise<void> {
  await graphqlRequest(MARK_ALL_READ_MUTATION, { token, cache: 'no-store' });
}

const MARK_READ_MUTATION = /* GraphQL */ `
  mutation MarkRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
    }
  }
`;

export async function markNotificationRead(id: string, token: string): Promise<void> {
  await graphqlRequest(MARK_READ_MUTATION, { variables: { id }, token, cache: 'no-store' });
}

/* ---- Mutations ----------------------------------------------------------- */

export interface AuthResult {
  accessToken: string;
  studentId: string;
}

export interface SignupResult {
  studentId: string;
  requiresVerification: boolean;
  /** Non-production only — surfaced so the verify step can prefill the code. */
  devCode: string | null;
  /** A fixed code this deployment accepts from anyone, shown as a demo shortcut. */
  demoCode: string | null;
}

const SIGNUP_MUTATION = /* GraphQL */ `
  mutation Signup($fullName: String!, $email: String!, $password: String!) {
    signup(fullName: $fullName, email: $email, password: $password) {
      studentId
      requiresVerification
      devCode
      demoCode
    }
  }
`;

export async function signup(
  fullName: string,
  email: string,
  password: string,
): Promise<SignupResult> {
  const data = await graphqlRequest<{ signup: SignupResult }>(SIGNUP_MUTATION, {
    variables: { fullName, email, password },
    cache: 'no-store',
  });
  return data.signup;
}

const VERIFY_EMAIL_MUTATION = /* GraphQL */ `
  mutation VerifyEmail($email: String!, $code: String!) {
    verifyEmail(email: $email, code: $code) {
      accessToken
      studentId
    }
  }
`;

export async function verifyEmail(email: string, code: string): Promise<AuthResult> {
  const data = await graphqlRequest<{ verifyEmail: AuthResult }>(VERIFY_EMAIL_MUTATION, {
    variables: { email, code },
    cache: 'no-store',
  });
  return data.verifyEmail;
}

const RESEND_CODE_MUTATION = /* GraphQL */ `
  mutation ResendCode($email: String!) {
    resendVerificationCode(email: $email) {
      devCode
      demoCode
    }
  }
`;

export async function resendVerificationCode(
  email: string,
): Promise<{ devCode: string | null; demoCode: string | null }> {
  const data = await graphqlRequest<{
    resendVerificationCode: { devCode: string | null; demoCode: string | null };
  }>(RESEND_CODE_MUTATION, { variables: { email }, cache: 'no-store' });
  return data.resendVerificationCode;
}

export type OAuthProvider = 'GOOGLE' | 'APPLE';

// There is no unverified `oauthSignin` client mutation by design: social
// sign-in always exchanges a provider-issued ID token (see googleSignin /
// appleSignin), which the API verifies against the provider's JWKS.

const GOOGLE_SIGNIN_MUTATION = /* GraphQL */ `
  mutation GoogleSignin($idToken: String!) {
    googleSignin(idToken: $idToken) {
      accessToken
      studentId
    }
  }
`;

export async function googleSignin(idToken: string): Promise<AuthResult> {
  const data = await graphqlRequest<{ googleSignin: AuthResult }>(GOOGLE_SIGNIN_MUTATION, {
    variables: { idToken },
    cache: 'no-store',
  });
  return data.googleSignin;
}

const APPLE_SIGNIN_MUTATION = /* GraphQL */ `
  mutation AppleSignin($idToken: String!) {
    appleSignin(idToken: $idToken) {
      accessToken
      studentId
    }
  }
`;

export async function appleSignin(idToken: string): Promise<AuthResult> {
  const data = await graphqlRequest<{ appleSignin: AuthResult }>(APPLE_SIGNIN_MUTATION, {
    variables: { idToken },
    cache: 'no-store',
  });
  return data.appleSignin;
}

const SIGNIN_MUTATION = /* GraphQL */ `
  mutation Signin($email: String!, $password: String!) {
    signin(email: $email, password: $password) {
      accessToken
      studentId
    }
  }
`;

export async function signin(email: string, password: string): Promise<AuthResult> {
  const data = await graphqlRequest<{ signin: AuthResult }>(SIGNIN_MUTATION, {
    variables: { email, password },
    cache: 'no-store',
  });
  return data.signin;
}

const RESCHEDULE_MUTATION = /* GraphQL */ `
  mutation Reschedule($id: ID!, $startTime: String!) {
    rescheduleBooking(id: $id, startTime: $startTime) {
      id
      startTime
      status
    }
  }
`;

export async function rescheduleBooking(
  id: string,
  startTime: string,
  token: string,
): Promise<void> {
  await graphqlRequest(RESCHEDULE_MUTATION, {
    variables: { id, startTime },
    token,
    cache: 'no-store',
  });
}

const CANCEL_MUTATION = /* GraphQL */ `
  mutation Cancel($id: ID!) {
    cancelBooking(id: $id) {
      id
      status
    }
  }
`;

export async function cancelBooking(id: string, token: string): Promise<void> {
  await graphqlRequest(CANCEL_MUTATION, { variables: { id }, token, cache: 'no-store' });
}

const REVIEW_MUTATION = /* GraphQL */ `
  mutation Review($bookingId: ID!, $rating: Int!, $comment: String) {
    leaveReview(bookingId: $bookingId, rating: $rating, comment: $comment) {
      id
      rating
    }
  }
`;

export async function leaveReview(
  bookingId: string,
  rating: number,
  comment: string | null,
  token: string,
): Promise<void> {
  await graphqlRequest(REVIEW_MUTATION, {
    variables: { bookingId, rating, comment },
    token,
    cache: 'no-store',
  });
}

const ADD_FAVORITE_MUTATION = /* GraphQL */ `
  mutation AddFavorite($tutorId: ID!) {
    addFavorite(tutorId: $tutorId) {
      id
    }
  }
`;

const REMOVE_FAVORITE_MUTATION = /* GraphQL */ `
  mutation RemoveFavorite($tutorId: ID!) {
    removeFavorite(tutorId: $tutorId) {
      id
    }
  }
`;

export async function setFavorite(
  tutorId: string,
  favorited: boolean,
  token: string,
): Promise<void> {
  await graphqlRequest(favorited ? ADD_FAVORITE_MUTATION : REMOVE_FAVORITE_MUTATION, {
    variables: { tutorId },
    token,
    cache: 'no-store',
  });
}

const REDEEM_MUTATION = /* GraphQL */ `
  mutation Redeem($code: String!) {
    redeemGiftCard(code: $code) {
      balanceCents
    }
  }
`;

export async function redeemGiftCard(code: string, token: string): Promise<void> {
  await graphqlRequest(REDEEM_MUTATION, { variables: { code }, token, cache: 'no-store' });
}

export interface BuyGiftCardInput {
  amountCents: number;
  design: number;
  toName?: string | null;
  fromName?: string | null;
  message?: string | null;
}

const BUY_GIFT_CARD_MUTATION = /* GraphQL */ `
  mutation BuyGiftCard(
    $amountCents: Int!
    $design: Int!
    $toName: String
    $fromName: String
    $message: String
  ) {
    buyGiftCard(
      amountCents: $amountCents
      design: $design
      toName: $toName
      fromName: $fromName
      message: $message
    ) {
      id
      code
    }
  }
`;

export async function buyGiftCard(input: BuyGiftCardInput, token: string): Promise<void> {
  await graphqlRequest(BUY_GIFT_CARD_MUTATION, {
    variables: {
      amountCents: input.amountCents,
      design: input.design,
      toName: input.toName ?? null,
      fromName: input.fromName ?? null,
      message: input.message ?? null,
    },
    token,
    cache: 'no-store',
  });
}

const ADD_PAYMENT_METHOD_MUTATION = /* GraphQL */ `
  mutation AddPaymentMethod($brand: String!, $last4: String!, $expMonth: Int!, $expYear: Int!) {
    addPaymentMethod(brand: $brand, last4: $last4, expMonth: $expMonth, expYear: $expYear) {
      id
    }
  }
`;

export async function addPaymentMethod(
  brand: string,
  last4: string,
  expMonth: number,
  expYear: number,
  token: string,
): Promise<void> {
  await graphqlRequest(ADD_PAYMENT_METHOD_MUTATION, {
    variables: { brand, last4, expMonth, expYear },
    token,
    cache: 'no-store',
  });
}

const UPDATE_PROFILE_MUTATION = /* GraphQL */ `
  mutation UpdateProfile($fullName: String, $phone: String, $avatarColor: String) {
    updateProfile(fullName: $fullName, phone: $phone, avatarColor: $avatarColor) {
      id
    }
  }
`;

export async function updateProfile(
  input: { fullName?: string; phone?: string; avatarColor?: string },
  token: string,
): Promise<void> {
  await graphqlRequest(UPDATE_PROFILE_MUTATION, {
    variables: {
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
      avatarColor: input.avatarColor ?? null,
    },
    token,
    cache: 'no-store',
  });
}

const UPDATE_NOTIF_MUTATION = /* GraphQL */ `
  mutation UpdateNotif(
    $notifyEmail: Boolean
    $notifySms: Boolean
    $notifyReminders: Boolean
    $notifyPromos: Boolean
  ) {
    updateNotificationPrefs(
      notifyEmail: $notifyEmail
      notifySms: $notifySms
      notifyReminders: $notifyReminders
      notifyPromos: $notifyPromos
    ) {
      id
    }
  }
`;

export async function updateNotificationPrefs(
  prefs: Partial<{
    notifyEmail: boolean;
    notifySms: boolean;
    notifyReminders: boolean;
    notifyPromos: boolean;
  }>,
  token: string,
): Promise<void> {
  await graphqlRequest(UPDATE_NOTIF_MUTATION, {
    variables: {
      notifyEmail: prefs.notifyEmail ?? null,
      notifySms: prefs.notifySms ?? null,
      notifyReminders: prefs.notifyReminders ?? null,
      notifyPromos: prefs.notifyPromos ?? null,
    },
    token,
    cache: 'no-store',
  });
}

const TWO_FACTOR_MUTATION = /* GraphQL */ `
  mutation SetTwoFactor($enabled: Boolean!) {
    setTwoFactor(enabled: $enabled) {
      id
    }
  }
`;

export async function setTwoFactor(enabled: boolean, token: string): Promise<void> {
  await graphqlRequest(TWO_FACTOR_MUTATION, {
    variables: { enabled },
    token,
    cache: 'no-store',
  });
}

const CHANGE_PASSWORD_MUTATION = /* GraphQL */ `
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      id
    }
  }
`;

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<void> {
  await graphqlRequest(CHANGE_PASSWORD_MUTATION, {
    variables: { currentPassword, newPassword },
    token,
    cache: 'no-store',
  });
}

const DELETE_ACCOUNT_MUTATION = /* GraphQL */ `
  mutation DeleteAccount {
    deleteAccount
  }
`;

export async function deleteAccount(token: string): Promise<void> {
  await graphqlRequest(DELETE_ACCOUNT_MUTATION, { token, cache: 'no-store' });
}

/* ---- Booking assistant ---------------------------------------------------- */

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * A follow-up destination the reply suggests, derived from the tools the model
 * ran. The API names *what* to open; the client turns it into a localized URL.
 */
export type AssistantAction =
  | { kind: 'search'; subject?: string; level?: string }
  | { kind: 'tutor'; tutorId: string; tutorName?: string }
  | { kind: 'lessons' };

export interface AssistantReply {
  reply: string;
  /** Tools the model invoked this turn, surfaced so the UI can show its working. */
  toolsUsed: string[];
  /** In-app links to offer beneath the reply (may be absent on older servers). */
  actions?: AssistantAction[];
}

/**
 * One assistant turn. REST rather than GraphQL — this is the only endpoint that
 * isn't, and it predates the GraphQL surface.
 *
 * The API books as the token's owner, so the caller must be a signed-in student.
 * 503 means the deployment has no OPENAI_API_KEY; 429 means the per-caller turn
 * limit was hit. Both are expected states the UI explains rather than errors.
 */
export async function assistantChat(
  messages: AssistantTurn[],
  token: string,
): Promise<AssistantReply | { unavailable: true } | { rateLimited: true }> {
  const res = await fetch(`${API_URL}/assistant/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
    cache: 'no-store',
  });
  if (res.status === 503) return { unavailable: true };
  if (res.status === 429) return { rateLimited: true };
  if (!res.ok) throw new Error(`Assistant request failed: ${res.status}`);
  return (await res.json()) as AssistantReply;
}
