'use server';

import { revalidatePath } from 'next/cache';
import { GraphQLRequestError } from './graphql';
import {
  addPaymentMethod as addPaymentMethodMutation,
  bookLesson,
  buyGiftCard as buyGiftCardMutation,
  cancelBooking as cancelBookingMutation,
  changePassword as changePasswordMutation,
  leaveReview as leaveReviewMutation,
  redeemGiftCard as redeemGiftCardMutation,
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

export async function signupAction(
  fullName: string,
  email: string,
  password: string,
): Promise<ActionResult> {
  try {
    const { accessToken } = await signup(fullName, email, password);
    await setSessionToken(accessToken);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof GraphQLRequestError ? err.message : 'SIGNUP_FAILED' };
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

export async function logoutAction(): Promise<void> {
  await clearSession();
  revalidatePath('/', 'layout');
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
