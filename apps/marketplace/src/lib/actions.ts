'use server';

import { revalidatePath } from 'next/cache';
import { GraphQLRequestError } from './graphql';
import {
  addPaymentMethod as addPaymentMethodMutation,
  bookLesson,
  buyGiftCard as buyGiftCardMutation,
  cancelBooking as cancelBookingMutation,
  changePassword as changePasswordMutation,
  deleteAccount as deleteAccountMutation,
  appleSignin,
  googleSignin,
  leaveReview as leaveReviewMutation,
  markAllNotificationsRead as markAllNotificationsReadMutation,
  markNotificationRead as markNotificationReadMutation,
  oauthSignin,
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
  type BookLessonInput,
  type BuyGiftCardInput,
} from './queries';
import { clearSession, getTokenOrDemo, setSessionToken } from './session';

export interface ActionResult {
  ok: boolean;
  /** Present when `ok` is false: the GraphQL message or a generic code. */
  error?: string;
}

/** Run a mutation, mapping GraphQL errors onto a uniform result shape. */
async function run(fn: () => Promise<void>, fallback: string): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    const error = err instanceof GraphQLRequestError ? err.message : fallback;
    return { ok: false, error };
  }
}

/* ---- Auth ---------------------------------------------------------------- */

export interface SignupActionResult extends ActionResult {
  /** Non-production helper so the verify step can prefill the emailed code. */
  devCode?: string | null;
}

/** Step 1–2: create the account and start email verification (no session yet). */
export async function signupAction(
  fullName: string,
  email: string,
  password: string,
): Promise<SignupActionResult> {
  try {
    const { devCode } = await signup(fullName, email, password);
    return { ok: true, devCode };
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
    const { devCode } = await resendVerificationCode(email);
    return { ok: true, devCode };
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

/**
 * Sign in via a social provider. The provider handshake is simulated client-
 * side (no external secret); the backend upsert + session are real.
 */
export async function oauthSigninAction(
  provider: 'GOOGLE' | 'APPLE',
  providerUserId: string,
  email: string,
  fullName: string,
): Promise<ActionResult> {
  try {
    const { accessToken } = await oauthSignin(provider, providerUserId, email, fullName);
    await setSessionToken(accessToken);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof GraphQLRequestError ? err.message : 'OAUTH_FAILED' };
  }
}

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
    await markAllNotificationsReadMutation(await getTokenOrDemo());
  }, 'NOTIFS_FAILED');
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const result = await run(async () => {
    await markNotificationReadMutation(id, await getTokenOrDemo());
  }, 'NOTIF_FAILED');
  if (result.ok) revalidatePath('/', 'layout');
  return result;
}

/* ---- Booking & lessons --------------------------------------------------- */

export async function bookLessonAction(input: BookLessonInput): Promise<ActionResult> {
  const result = await run(async () => {
    const token = await getTokenOrDemo();
    await bookLesson(input, token);
  }, 'BOOKING_FAILED');
  if (result.ok) revalidatePath('/[locale]/lessons', 'page');
  return result;
}

export async function cancelBookingAction(id: string): Promise<ActionResult> {
  const result = await run(async () => {
    await cancelBookingMutation(id, await getTokenOrDemo());
  }, 'CANCEL_FAILED');
  if (result.ok) revalidatePath('/[locale]/lessons', 'page');
  return result;
}

export async function rescheduleBookingAction(
  id: string,
  startTime: string,
): Promise<ActionResult> {
  const result = await run(async () => {
    await rescheduleBookingMutation(id, startTime, await getTokenOrDemo());
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
    await leaveReviewMutation(bookingId, rating, comment, await getTokenOrDemo());
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
    await setFavoriteMutation(tutorId, favorited, await getTokenOrDemo());
  }, 'FAVORITE_FAILED');
  if (result.ok) revalidatePath('/[locale]/favourites', 'page');
  return result;
}

/* ---- Wallet -------------------------------------------------------------- */

export async function redeemGiftCardAction(code: string): Promise<ActionResult> {
  const result = await run(async () => {
    await redeemGiftCardMutation(code, await getTokenOrDemo());
  }, 'REDEEM_FAILED');
  if (result.ok) revalidatePath('/[locale]/wallet', 'page');
  return result;
}

export async function buyGiftCardAction(input: BuyGiftCardInput): Promise<ActionResult> {
  const result = await run(async () => {
    await buyGiftCardMutation(input, await getTokenOrDemo());
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
    await addPaymentMethodMutation(brand, last4, expMonth, expYear, await getTokenOrDemo());
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
    await updateProfileMutation(input, await getTokenOrDemo());
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
    await updateNotificationPrefsMutation(prefs, await getTokenOrDemo());
  }, 'PREFS_FAILED');
  if (result.ok) revalidatePath('/[locale]/account', 'page');
  return result;
}

export async function setTwoFactorAction(enabled: boolean): Promise<ActionResult> {
  const result = await run(async () => {
    await setTwoFactorMutation(enabled, await getTokenOrDemo());
  }, 'TWO_FACTOR_FAILED');
  if (result.ok) revalidatePath('/[locale]/account', 'page');
  return result;
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  return run(async () => {
    await changePasswordMutation(currentPassword, newPassword, await getTokenOrDemo());
  }, 'PASSWORD_FAILED');
}

export async function deleteAccountAction(): Promise<ActionResult> {
  const result = await run(async () => {
    await deleteAccountMutation(await getTokenOrDemo());
  }, 'DELETE_FAILED');
  if (result.ok) {
    await clearSession();
    revalidatePath('/', 'layout');
  }
  return result;
}
