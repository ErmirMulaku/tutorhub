import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import type { Student } from '../generated/prisma/client.js';
import { StudentModel } from '../graphql/models/student.model.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Resolver(() => StudentModel)
export class AuthResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => StudentModel, { name: 'me' })
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<Student> {
    return this.prisma.student.findUniqueOrThrow({ where: { id: user.studentId } });
  }
}
