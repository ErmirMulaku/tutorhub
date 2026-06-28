import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateTutorProfileInput {
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() name?: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() headline?: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() about?: string;
  @Field(() => String, { nullable: true }) @IsOptional() @IsString() timezone?: string;
  @Field(() => [String], { nullable: true }) @IsOptional() @IsArray() languages?: string[];
}

@InputType()
export class UpdateNotificationPrefsInput {
  @Field({ nullable: true }) @IsOptional() @IsBoolean() notifyBookings?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() notifyReminders?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() notifyMessages?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() notifyPayouts?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() notifyTips?: boolean;
}
