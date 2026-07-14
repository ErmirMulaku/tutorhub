import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import { PayoutSchedule } from '../generated/prisma/client.js';
import {
  EarningsSummaryModel,
  MonthlyEarningModel,
  TransactionModel,
} from '../graphql/models/earnings.model.js';
import {
  ConnectOnboardingLinkModel,
  ConnectStatusModel,
} from '../graphql/models/payments.model.js';
import {
  type ConnectStatus,
  type EarningsSummary,
  EarningsService,
  type MonthlyEarning,
  type TransactionRow,
} from './earnings.service.js';

@Resolver()
@UseGuards(TutorAuthGuard)
export class EarningsResolver {
  constructor(private readonly earnings: EarningsService) {}

  @Query(() => EarningsSummaryModel, { name: 'earningsSummary' })
  earningsSummary(@CurrentTutor() tutor: TutorPrincipal): Promise<EarningsSummary> {
    return this.earnings.summary(tutor.tutorId);
  }

  @Query(() => [MonthlyEarningModel], { name: 'earningsByMonth' })
  earningsByMonth(@CurrentTutor() tutor: TutorPrincipal): Promise<MonthlyEarning[]> {
    return this.earnings.byMonth(tutor.tutorId);
  }

  @Query(() => [TransactionModel], { name: 'transactions' })
  transactions(@CurrentTutor() tutor: TutorPrincipal): Promise<TransactionRow[]> {
    return this.earnings.transactions(tutor.tutorId);
  }

  @Mutation(() => EarningsSummaryModel, { name: 'withdraw' })
  withdraw(@CurrentTutor() tutor: TutorPrincipal): Promise<EarningsSummary> {
    return this.earnings.withdraw(tutor.tutorId);
  }

  @Mutation(() => EarningsSummaryModel, { name: 'setPayoutSchedule' })
  setPayoutSchedule(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('schedule', { type: () => PayoutSchedule }) schedule: PayoutSchedule,
  ): Promise<EarningsSummary> {
    return this.earnings.setPayoutSchedule(tutor.tutorId, schedule);
  }

  @Mutation(() => EarningsSummaryModel, { name: 'setPayoutMethod' })
  setPayoutMethod(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('method') method: string,
  ): Promise<EarningsSummary> {
    return this.earnings.setPayoutMethod(tutor.tutorId, method);
  }

  @Query(() => ConnectStatusModel, { name: 'connectStatus' })
  connectStatus(@CurrentTutor() tutor: TutorPrincipal): Promise<ConnectStatus> {
    return this.earnings.connectStatus(tutor.tutorId);
  }

  @Mutation(() => ConnectOnboardingLinkModel, { name: 'startConnectOnboarding' })
  async startConnectOnboarding(@CurrentTutor() tutor: TutorPrincipal): Promise<{ url: string }> {
    return { url: await this.earnings.startConnectOnboarding(tutor.tutorId) };
  }
}
