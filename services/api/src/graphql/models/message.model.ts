import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { SenderKind } from '../../generated/prisma/client.js';

@ObjectType('Message')
export class MessageModel {
  @Field(() => ID) id!: string;
  @Field(() => SenderKind) senderKind!: SenderKind;
  @Field() body!: string;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
}

/** A conversation row enriched for the thread list (preview + unread count). */
@ObjectType('Conversation')
export class ConversationModel {
  @Field(() => ID) id!: string;
  @Field() studentName!: string;
  @Field(() => String, { nullable: true }) studentAvatarColor!: string | null;
  @Field(() => String, { nullable: true }) subjectName!: string | null;
  @Field(() => GraphQLISODateTime) lastMessageAt!: Date;
  @Field(() => String, { nullable: true }) preview!: string | null;
  @Field(() => Int) unread!: number;
}
