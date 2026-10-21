import {
  createActionGroup,
  createFeature,
  createReducer,
  emptyProps,
  on,
  props,
} from '@ngrx/store';
import type { DashboardSummary, MeTutor } from '../api/models';

/**
 * Tutor data the whole shell reads: the sidebar (name, badges, profile link)
 * and the dashboard (greeting, KPIs, setup banner). Keeping it in the store
 * means one request each, shared by every reader — what RTK Query's cache did
 * for `getMeTutor`, `getDashboardSummary` and `getTutorSettings`.
 */
export interface DashboardState {
  me: MeTutor | null;
  summary: DashboardSummary | null;
  /** `tutorSettings.isActive` — onboarding is done. False until known (as in React). */
  published: boolean;
  summaryLoading: boolean;
}

const initialState: DashboardState = {
  me: null,
  summary: null,
  published: false,
  summaryLoading: false,
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
        summaryLoading: state.summary === null,
      }),
    ),
    on(
      DashboardActions.loadSummarySuccess,
      (state, { summary }): DashboardState => ({
        ...state,
        summary,
        summaryLoading: false,
      }),
    ),
    on(
      DashboardActions.loadSummaryFailure,
      (state): DashboardState => ({
        ...state,
        summaryLoading: false,
      }),
    ),
    on(
      DashboardActions.loadPublishedSuccess,
      (state, { published }): DashboardState => ({
        ...state,
        published,
      }),
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
