import { registerEnumType } from '@nestjs/graphql';
import {
  BookingStatus,
  DiscountType,
  Level,
  NotificationType,
  OAuthProvider,
  PayoutSchedule,
  PromotionState,
  SenderKind,
  ServiceType,
} from '../generated/prisma/client.js';

// Side-effect module: register domain enums with the GraphQL type system.
// Imported once (from AppModule) before the schema is built. The Prisma enums
// have UPPER_SNAKE values, so the SDL matches SPEC §9 (e.g. `BEGINNER`).
registerEnumType(Level, { name: 'Level' });
registerEnumType(BookingStatus, { name: 'BookingStatus' });
registerEnumType(NotificationType, { name: 'NotificationType' });
registerEnumType(OAuthProvider, { name: 'OAuthProvider' });
registerEnumType(ServiceType, { name: 'ServiceType' });
registerEnumType(SenderKind, { name: 'SenderKind' });
registerEnumType(PayoutSchedule, { name: 'PayoutSchedule' });
registerEnumType(PromotionState, { name: 'PromotionState' });
registerEnumType(DiscountType, { name: 'DiscountType' });
