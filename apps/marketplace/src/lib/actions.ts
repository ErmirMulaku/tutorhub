'use server';

import { revalidatePath } from 'next/cache';
import { GraphQLRequestError } from './graphql';
import {
  addPaymentMethod as addPaymentMethodMutation,
  assistantChat,
  bookLesson,
  buyGiftCard as buyGiftCardMutation,
  cancelBooking as cancelBookingMutation,
  changePassword as changePasswordMutation,
  createLessonPaymentIntent,
  deleteAccount as deleteAccountMutation,
  appleSignin,
  googleSignin,
  leaveReview as leaveReviewMutation,
  markAllNotificationsRead as markAllNotificationsReadMutation,
  markNotificationRead as markNotificationReadMutation,
  redeemGiftCard as redeemGiftCardMutation,
  resendVerificationCode,
  verifyEmail,
  rescheduleBooking as rescheduleBookingMutation,
  setFavorite as setFavoriteMutation,
  setTwoFactor as setTwoFactorMutation,
  signin,
  signup,
  updateNotificationPrefs as updateNotificationPrefsMutation,
  updateProfile as updateProfileMutation,
  type AssistantTurn,
  type BookLessonInput,
  type BuyGiftCardInput,
} from './queries';
import {
  clearSession,
  NotAuthenticatedError,
  requireSessionTokenForAction,
  setSessionToken,
} from './session';

export interface ActionResult {
  ok: boolean;
  /** Present when `ok` is false: the GraphQL message or a generic code. */
  error?: string;
  /** True when the action needs a signed-in student — prompt them to sign in. */
  needsAuth?: boolean;
}

/** Run a mutation, mapping GraphQL and auth errors onto a uniform result shape. */
async function run(fn: () => Promise<void>, fallback: string): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return { ok: false, needsAuth: true, error: 'NOT_AUTHENTICATED' };
    }
    const error = err instanceof GraphQLRequestError ? err.message : fallback;
    return { ok: false, error };
  }
}

/* ---- Auth ---------------------------------------------------------------- */

export interface SignupActionResult extends ActionResult {
  /** Non-production helper so the verify step can prefill the emailed code. */
  devCode?: string | null;
  demoCode?: string | null;
}

/** Step 1–2: create the account and start email verification (no session yet). */
export async function signupAction(
  fullName: string,
  email: string,
  password: string,
): Promise<SignupActionResult> {
  try {
    const { devCode, demoCode } = await signup(fullName, email, password);
    return { ok: true, devCode, demoCode };
  } catch (err) {
    return { ok: false, error: err instanceof GraphQLRequestError ? err.message : 'SIGNUP_FAILED' };
  }
}

/** Step 3: confirm the 6-digit code, which establishes the session. */
export async function verifyEmailAction(email: string, code: string): Promise<ActionResult> {
  try {
    const { accessToken } = await verifyEmail(email, code);
    await setSessionToken(accessToken);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof GraphQLRequestError ? err.message : 'VERIFY_FAILED' };
  }
}

export async function resendCodeAction(email: string): Promise<SignupActionResult> {
  try {
    const { devCode, demoCode } = await resendVerificationCode(email);
    return { ok: true, devCode, demoCode };
  } catch (err) {
    return { ok: false, error: err instanceof GraphQLRequestError ? err.message : 'RESEND_FAILED' };
  }
}

export async function signinAction(email: string, password: string): Promise<ActionResult> {
  try {
    const { accessToken } = await signin(email, password);
    await setSessionToken(accessToken);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof GraphQLRequestError ? err.message : 'SIGNIN_FAILED' };
  }
}

// `oauthSigninAction` was removed: it accepted a client-asserted (provider,
// email) pair, which meant anyone invoking the Server Action could sign in as
// any user. Social sign-in now goes exclusively through the ID-token actions
// below, which the API verifies against the provider's JWKS.

/** Real Google sign-in: exchange the GIS ID token for a session. */
export async function googleSigninAction(idToken: string): Promise<ActionResult> {
  try {
    const { accessToken } = await googleSignin(idToken);
    await setSessionToken(accessToken);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof GraphQLRequestError ? err.message : 'OAUTH_FAILED' };
  }
}

/** Real Apple sign-in: exchange the Sign in with Apple id_token for a session. */
export async function appleSigninAction(idToken: string): Promise<ActionResult> {
  try {
    const { accessToken } = await appleSignin(idToken);
    await setSessionToken(accessToken);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof GraphQLRequestError ? err.message : 'OAUTH_FAILED' };
  }
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  revalidatePath('/', 'layout');
}

/* ---- Notifications ------------------------------------------------------- */

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const result = await run(async () => {
    await markAllNotificationsReadMutation(await requireSessionTokenForAction());
  }, 'NOTIFS_FAILED');
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const result = await run(async () => {
    await markNotificationReadMutation(id, await requireSessionTokenForAction());
  }, 'NOTIF_FAILED');
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

/* ---- Booking & lessons --------------------------------------------------- */

export async function bookLessonAction(input: BookLessonInput): Promise<ActionResult> {
  const result = await run(async () => {
    const token = await requireSessionTokenForAction();
    await bookLesson(input, token);
  }, 'BOOKING_FAILED');
  if (result.ok) revalidatePath('/[locale]/lessons', 'page');
  return result;
}

export interface PaymentIntentActionResult extends ActionResult {
  clientSecret?: string;
  bookingId?: string;
  /** True when the API has no Stripe key — the caller should fall back to a free booking. */
  paymentsDisabled?: boolean;
}

/** Start a paid booking: returns the PaymentIntent client secret to confirm in the browser. */
export async function createLessonPaymentIntentAction(
  input: BookLessonInput,
): Promise<PaymentIntentActionResult> {
  try {
    const token = await requireSessionTokenForAction();
    const intent = await createLessonPaymentIntent(input, token);
    revalidatePath('/[locale]/lessons', 'page');
    return { ok: true, clientSecret: intent.clientSecret, bookingId: intent.bookingId };
  } catch (err) {
    if (err instanceof NotAuthenticatedError) {
      return { ok: false, needsAuth: true, error: 'NOT_AUTHENTICATED' };
    }
    if (err instanceof GraphQLRequestError && err.message.includes('not configured')) {
      return { ok: false, paymentsDisabled: true, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof GraphQLRequestError ? err.message : 'PAYMENT_FAILED',
    };
  }
}

export async function cancelBookingAction(id: string): Promise<ActionResult> {
  const result = await run(async () => {
    await cancelBookingMutation(id, await requireSessionTokenForAction());
  }, 'CANCEL_FAILED');
  if (result.ok) revalidatePath('/[locale]/lessons', 'page');
  return result;
}

export async function rescheduleBookingAction(
  id: string,
  startTime: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    await rescheduleBookingMutation(id, startTime, await requireSessionTokenForAction());
  }, 'RESCHEDULE_FAILED');
  if (result.ok) revalidatePath('/[locale]/lessons', 'page');
  return result;
}

export async function leaveReviewAction(
  bookingId: string,
  rating: number,
  comment: string | null,
): Promise<ActionResult> {
  const result = await run(async () => {
    await leaveReviewMutation(bookingId, rating, comment, await requireSessionTokenForAction());
  }, 'REVIEW_FAILED');
  if (result.ok) revalidatePath('/[locale]/lessons', 'page');
  return result;
}

/* ---- Favourites ---------------------------------------------------------- */

export async function toggleFavoriteAction(
  tutorId: string,
  favorited: boolean,
): Promise<ActionResult> {
  const result = await run(async () => {
    await setFavoriteMutation(tutorId, favorited, await requireSessionTokenForAction());
  }, 'FAVORITE_FAILED');
  if (result.ok) revalidatePath('/[locale]/favourites', 'page');
  return result;
}

/* ---- Wallet -------------------------------------------------------------- */

export async function redeemGiftCardAction(code: string): Promise<ActionResult> {
  const result = await run(async () => {
    await redeemGiftCardMutation(code, await requireSessionTokenForAction());
  }, 'REDEEM_FAILED');
  if (result.ok) revalidatePath('/[locale]/wallet', 'page');
  return result;
}

export async function buyGiftCardAction(input: BuyGiftCardInput): Promise<ActionResult> {
  const result = await run(async () => {
    await buyGiftCardMutation(input, await requireSessionTokenForAction());
  }, 'GIFTCARD_FAILED');
  if (result.ok) revalidatePath('/[locale]/wallet', 'page');
  return result;
}

export async function addPaymentMethodAction(
  brand: string,
  last4: string,
  expMonth: number,
  expYear: number,
): Promise<ActionResult> {
  const result = await run(async () => {
    await addPaymentMethodMutation(
      brand,
      last4,
      expMonth,
      expYear,
      await requireSessionTokenForAction(),
    );
  }, 'PAYMENT_METHOD_FAILED');
  if (result.ok) revalidatePath('/[locale]/wallet', 'page');
  return result;
}

/* ---- Account ------------------------------------------------------------- */

export async function updateProfileAction(input: {
  fullName?: string;
  phone?: string;
  avatarColor?: string;
}): Promise<ActionResult> {
  const result = await run(async () => {
    await updateProfileMutation(input, await requireSessionTokenForAction());
  }, 'PROFILE_FAILED');
  if (result.ok) revalidatePath('/[locale]/account', 'page');
  return result;
}

export async function updateNotificationPrefsAction(
  prefs: Partial<{
    notifyEmail: boolean;
    notifySms: boolean;
    notifyReminders: boolean;
    notifyPromos: boolean;
  }>,
): Promise<ActionResult> {
  const result = await run(async () => {
    await updateNotificationPrefsMutation(prefs, await requireSessionTokenForAction());
  }, 'PREFS_FAILED');
  if (result.ok) revalidatePath('/[locale]/account', 'page');
  return result;
}

export async function setTwoFactorAction(enabled: boolean): Promise<ActionResult> {
  const result = await run(async () => {
    await setTwoFactorMutation(enabled, await requireSessionTokenForAction());
  }, 'TWO_FACTOR_FAILED');
  if (result.ok) revalidatePath('/[locale]/account', 'page');
  return result;
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  return run(async () => {
    await changePasswordMutation(
      currentPassword,
      newPassword,
      await requireSessionTokenForAction(),
    );
  }, 'PASSWORD_FAILED');
}

export async function deleteAccountAction(): Promise<ActionResult> {
  const result = await run(async () => {
    await deleteAccountMutation(await requireSessionTokenForAction());
  }, 'DELETE_FAILED');
  if (result.ok) {
    await clearSession();
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * One booking-assistant turn.
 *
 * The token stays server-side: the assistant can create bookings, so the
 * browser never holds a credential that could drive it directly.
 *
 * `unavailable` and `rateLimited` are ordinary states, not failures — the
 * deployment may have no OpenAI key, and every caller has a turn budget.
 */
export async function assistantChatAction(
  messages: AssistantTurn[],
): Promise<
  | { ok: true; reply: string; toolsUsed: string[] }
  | { ok: false; reason: 'UNAVAILABLE' | 'RATE_LIMITED' | 'FAILED' }
> {
  try {
    const res = await assistantChat(messages, await requireSessionTokenForAction());
    if ('unavailable' in res) return { ok: false, reason: 'UNAVAILABLE' };
    if ('rateLimited' in res) return { ok: false, reason: 'RATE_LIMITED' };
    return { ok: true, reply: res.reply, toolsUsed: res.toolsUsed };
  } catch {
    return { ok: false, reason: 'FAILED' };
  }
}
