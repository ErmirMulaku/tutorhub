import { Field, ID, ObjectType } from '@nestjs/graphql';

/** Returned by `createLessonPaymentIntent` — the client confirms the card with `clientSecret`. */
@ObjectType('LessonPaymentIntent')
export class LessonPaymentIntentModel {
  @Field() clientSecret!: string;
  @Field(() => ID) bookingId!: string;
  @Field(() => ID) paymentId!: string;
}

/** A hosted Stripe Connect onboarding URL for the tutor to complete payout setup. */
@ObjectType('ConnectOnboardingLink')
export class ConnectOnboardingLinkModel {
  @Field() url!: string;
}

/** Whether the tutor has a Connect account and can receive payouts. */
@ObjectType('ConnectStatus')
export class ConnectStatusModel {
  @Field() onboarded!: boolean;
  @Field() payoutsEnabled!: boolean;
}
