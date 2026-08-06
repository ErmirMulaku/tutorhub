import { configureStore, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit';
import { api } from './api';
import { authReducer, clearCredentials, setCredentials } from './auth-slice';
import { uiReducer } from './ui-slice';

/**
 * Wipe every cached response whenever the signed-in tutor changes.
 *
 * The RTK Query cache is keyed by endpoint, not by account, so without this a
 * sign-out followed by a sign-in leaves the previous tutor's `meTutor`,
 * settings, bookings and earnings in the store — the new session renders the
 * old account's name and data until each query happens to refetch.
 *
 * Done here as a listener rather than at the call sites so that every path that
 * changes credentials is covered: sign-in, register, email verification, sign
 * out, account deletion, and the 401 handler in the base query.
 */
const authListener = createListenerMiddleware();
authListener.startListening({
  matcher: isAnyOf(setCredentials, clearCredentials),
  effect: (_action, listenerApi) => {
    listenerApi.dispatch(api.util.resetApiState());
  },
});

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(authListener.middleware).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
