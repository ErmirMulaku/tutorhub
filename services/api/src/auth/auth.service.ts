import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EntityNotFoundError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Dev-only login: mints a JWT for an existing student by email. Real password
   * auth is out of scope (mocked) — the token is the same one every transport
   * verifies.
   */
  async devLogin(email: string): Promise<{ accessToken: string }> {
    const student = await this.prisma.student.findUnique({ where: { email } });
    if (student === null) {
      throw new EntityNotFoundError('Student', email);
    }
    const accessToken = await this.jwt.signAsync({ sub: student.id });
    return { accessToken };
  }
}
