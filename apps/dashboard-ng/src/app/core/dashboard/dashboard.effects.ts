import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { DashboardApi } from '../api/dashboard-api';
import { errorMessage } from '../api/errors';
import { ProfileService } from '../api/profile.service';
import { DashboardActions } from './dashboard.store';

export const loadMe = createEffect(
  (actions$ = inject(Actions), profile = inject(ProfileService)) =>
    actions$.pipe(
      ofType(DashboardActions.loadMe),
      switchMap(() =>
        profile.meTutor().pipe(
          map((me) => DashboardActions.loadMeSuccess({ me })),
          catchError((err: unknown) =>
            of(DashboardActions.loadMeFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadSummary = createEffect(
  (actions$ = inject(Actions), api = inject(DashboardApi)) =>
    actions$.pipe(
      ofType(DashboardActions.loadSummary),
      switchMap(() =>
        api.summary().pipe(
          map((summary) => DashboardActions.loadSummarySuccess({ summary })),
          catchError((err: unknown) =>
            of(DashboardActions.loadSummaryFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadPublished = createEffect(
  (actions$ = inject(Actions), profile = inject(ProfileService)) =>
    actions$.pipe(
      ofType(DashboardActions.loadPublished),
      switchMap(() =>
        profile.isPublished().pipe(
          map((published) => DashboardActions.loadPublishedSuccess({ published })),
          catchError((err: unknown) =>
            of(DashboardActions.loadPublishedFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  { functional: true },
);

export const loadNotifications = createEffect(
  (actions$ = inject(Actions), api = inject(DashboardApi)) =>
    actions$.pipe(
      ofType(DashboardActions.loadNotifications),
      switchMap(() =>
        api.notifications().pipe(
          map((notifications) => DashboardActions.loadNotificationsSuccess({ notifications })),
          catchError((err: unknown) =>
            of(DashboardActions.loadNotificationsFailure({ error: errorMessage(err) })),
          ),
        ),
      ),
    ),
  { functional: true },
);
