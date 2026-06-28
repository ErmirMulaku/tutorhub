import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import {
  AnalyticsSummaryModel,
  DayCountModel,
  MonthCountModel,
  StudentMixModel,
  SubjectShareModel,
} from '../graphql/models/analytics.model.js';
import {
  type AnalyticsSummary,
  AnalyticsService,
  type DayCount,
  type MonthCount,
  type StudentMix,
  type SubjectShare,
} from './analytics.service.js';

@Resolver()
@UseGuards(TutorAuthGuard)
export class AnalyticsResolver {
  constructor(private readonly analytics: AnalyticsService) {}

  @Query(() => AnalyticsSummaryModel, { name: 'analyticsSummary' })
  analyticsSummary(@CurrentTutor() tutor: TutorPrincipal): Promise<AnalyticsSummary> {
    return this.analytics.summary(tutor.tutorId);
  }

  @Query(() => [MonthCountModel], { name: 'lessonsOverTime' })
  lessonsOverTime(@CurrentTutor() tutor: TutorPrincipal): Promise<MonthCount[]> {
    return this.analytics.lessonsOverTime(tutor.tutorId);
  }

  @Query(() => [SubjectShareModel], { name: 'topSubjects' })
  topSubjects(@CurrentTutor() tutor: TutorPrincipal): Promise<SubjectShare[]> {
    return this.analytics.topSubjects(tutor.tutorId);
  }

  @Query(() => [DayCountModel], { name: 'lessonsByDayOfWeek' })
  lessonsByDayOfWeek(@CurrentTutor() tutor: TutorPrincipal): Promise<DayCount[]> {
    return this.analytics.lessonsByDayOfWeek(tutor.tutorId);
  }

  @Query(() => StudentMixModel, { name: 'studentMix' })
  studentMix(@CurrentTutor() tutor: TutorPrincipal): Promise<StudentMix> {
    return this.analytics.studentMix(tutor.tutorId);
  }
}
