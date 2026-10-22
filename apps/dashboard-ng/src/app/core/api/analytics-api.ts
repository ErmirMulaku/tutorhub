import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { GraphqlClient } from './graphql-client';
import type { AnalyticsSummary, DayCount, MonthCount, StudentMix, SubjectShare } from './models';

/** Read-only analytics aggregates. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class AnalyticsApi {
  private readonly gql = inject(GraphqlClient);

  summary(): Observable<AnalyticsSummary> {
    return this.gql
      .request<{
        analyticsSummary: AnalyticsSummary;
      }>(`{ analyticsSummary { lessonsThisMonth newStudents repeatRatePct utilizationPct } }`)
      .pipe(map((r) => r.analyticsSummary));
  }

  lessonsOverTime(): Observable<MonthCount[]> {
    return this.gql
      .request<{ lessonsOverTime: MonthCount[] }>(`{ lessonsOverTime { month count } }`)
      .pipe(map((r) => r.lessonsOverTime));
  }

  topSubjects(): Observable<SubjectShare[]> {
    return this.gql
      .request<{ topSubjects: SubjectShare[] }>(`{ topSubjects { name pct } }`)
      .pipe(map((r) => r.topSubjects));
  }

  lessonsByDayOfWeek(): Observable<DayCount[]> {
    return this.gql
      .request<{ lessonsByDayOfWeek: DayCount[] }>(`{ lessonsByDayOfWeek { day count } }`)
      .pipe(map((r) => r.lessonsByDayOfWeek));
  }

  studentMix(): Observable<StudentMix> {
    return this.gql
      .request<{ studentMix: StudentMix }>(`{ studentMix { returningPct newPct } }`)
      .pipe(map((r) => r.studentMix));
  }
}
