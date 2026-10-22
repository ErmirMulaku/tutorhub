import {
  createActionGroup,
  createFeature,
  createReducer,
  emptyProps,
  on,
  props,
} from '@ngrx/store';
import type { DashboardSummary, MeTutor, TutorNotification } from '../api/models';

/**
 * Tutor data the whole shell reads: the sidebar (name, badges, profile link)
 * and the dashboard (greeting, KPIs, setup banner). Keeping it in the store
 * means one request each, shared by every reader — what RTK Query's cache did
 * for `getMeTutor`, `getDashboardSummary`, `getTutorSettings` and
 * `getTutorNotifications` (the topbar bell).
 */
export interface DashboardState {
  me: MeTutor | null;
  summary: DashboardSummary | null;
  /**
   * `tutorSettings.isActive` — onboarding is done; `null` until it has loaded.
   * React used `false` until known, so a published tutor saw the "finish
   * setting up" banner flash and vanish — a layout shift of everything below.
   */
  published: boolean | null;
  /** Set when the KPI summary failed to load; cleared by the next attempt. */
  summaryError: string | null;
  /** The bell's feed (pending requests, unread threads, recent reviews), newest first. */
  notifications: TutorNotification[];
}

const initialState: DashboardState = {
  me: null,
  summary: null,
  published: null,
  summaryError: null,
  notifications: [],
};

export const DashboardActions = createActionGroup({
  source: 'Dashboard',
  events: {
    'Load Me': emptyProps(),
    'Load Me Success': props<{ me: MeTutor }>(),
    'Load Me Failure': props<{ error: string }>(),

    'Load Summary': emptyProps(),
    'Load Summary Success': props<{ summary: DashboardSummary }>(),
    'Load Summary Failure': props<{ error: string }>(),

    'Load Published': emptyProps(),
    'Load Published Success': props<{ published: boolean }>(),
    'Load Published Failure': props<{ error: string }>(),

    'Load Notifications': emptyProps(),
    'Load Notifications Success': props<{ notifications: TutorNotification[] }>(),
    'Load Notifications Failure': props<{ error: string }>(),
  },
});

export const dashboardFeature = createFeature({
  name: 'dashboard',
  reducer: createReducer(
    initialState,
    on(DashboardActions.loadMeSuccess, (state, { me }): DashboardState => ({ ...state, me })),
    on(
      DashboardActions.loadSummary,
      (state): DashboardState => ({
        ...state,
        summaryError: null,
      }),
    ),
    on(
      DashboardActions.loadSummarySuccess,
      (state, { summary }): DashboardState => ({
        ...state,
        summary,
        summaryError: null,
      }),
    ),
    on(
      DashboardActions.loadSummaryFailure,
      (state, { error }): DashboardState => ({
        ...state,
        summaryError: error,
      }),
    ),
    on(
      DashboardActions.loadPublishedSuccess,
      (state, { published }): DashboardState => ({
        ...state,
        published,
      }),
    ),
    on(
      DashboardActions.loadNotificationsSuccess,
      (state, { notifications }): DashboardState => ({ ...state, notifications }),
    ),
    // A failed lookup counts as not published (use-profile-published.ts).
    on(
      DashboardActions.loadPublishedFailure,
      (state): DashboardState => ({
        ...state,
        published: false,
      }),
    ),
  ),
});
