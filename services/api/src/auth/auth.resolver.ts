import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { OAuthProvider, type Student, type Tutor } from '../generated/prisma/client.js';
import { AuthPayloadModel } from '../graphql/models/auth-payload.model.js';
import { ResendPayloadModel, SignupPayloadModel } from '../graphql/models/signup-payload.model.js';
import { StudentModel } from '../graphql/models/student.model.js';
import { TutorAuthPayloadModel } from '../graphql/models/tutor-auth-payload.model.js';
import { TutorModel } from '../graphql/models/tutor.model.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthResult, SignupResult, TutorAuthResult } from './auth.service.js';
import { AuthService } from './auth.service.js';
import type { AuthUser, TutorPrincipal } from './auth-user.js';
import { CurrentTutor } from './current-tutor.decorator.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { TutorAuthGuard } from './tutor-auth.guard.js';

@Resolver(() => StudentModel)
export class AuthResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  @Query(() => StudentModel, { name: 'me' })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<Student> {
    return this.prisma.student.findUniqueOrThrow({ where: { id: user.studentId } });
  }

  @Mutation(() => SignupPayloadModel, { name: 'signup' })
  signup(
    @Args('fullName') fullName: string,
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<SignupResult> {
    return this.auth.signup(fullName, email, password);
  }

  @Mutation(() => AuthPayloadModel, { name: 'verifyEmail' })
  verifyEmail(@Args('email') email: string, @Args('code') code: string): Promise<AuthResult> {
    return this.auth.verifyEmail(email, code);
  }

  @Mutation(() => ResendPayloadModel, { name: 'resendVerificationCode' })
  resendVerificationCode(@Args('email') email: string): Promise<{ devCode: string | null }> {
    return this.auth.resendVerificationCode(email);
  }

  @Mutation(() => AuthPayloadModel, { name: 'signin' })
  signin(@Args('email') email: string, @Args('password') password: string): Promise<AuthResult> {
    return this.auth.signin(email, password);
  }

  @Mutation(() => AuthPayloadModel, { name: 'oauthSignin' })
  oauthSignin(
    @Args('provider', { type: () => OAuthProvider }) provider: OAuthProvider,
    @Args('providerUserId') providerUserId: string,
    @Args('email') email: string,
    @Args('fullName') fullName: string,
  ): Promise<AuthResult> {
    return this.auth.oauthSignin(provider, providerUserId, email, fullName);
  }

  @Mutation(() => AuthPayloadModel, { name: 'googleSignin' })
  googleSignin(@Args('idToken') idToken: string): Promise<AuthResult> {
    return this.auth.googleSignin(idToken);
  }

  @Mutation(() => AuthPayloadModel, { name: 'appleSignin' })
  appleSignin(@Args('idToken') idToken: string): Promise<AuthResult> {
    return this.auth.appleSignin(idToken);
  }

  // --- Tutor (dashboard) auth ---

  @Query(() => TutorModel, { name: 'meTutor' })
  @UseGuards(TutorAuthGuard)
  meTutor(@CurrentTutor() tutor: TutorPrincipal): Promise<Tutor> {
    return this.prisma.tutor.findUniqueOrThrow({ where: { id: tutor.tutorId } });
  }

  @Mutation(() => TutorAuthPayloadModel, { name: 'tutorSignin' })
  tutorSignin(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<TutorAuthResult> {
    return this.auth.tutorSignin(email, password);
  }
}
