import { Body, Controller, HttpCode, HttpStatus, NotFoundException, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { DevLoginDto } from './dto/dev-login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Dev-login mints a session for any known email with **no password** — a local
   * convenience for tests and demos. It must never be reachable in production,
   * where it would be trivial account takeover. Gated here (hidden as 404) rather
   * than only in the app, so it is off by default wherever `NODE_ENV=production`.
   */
  private assertDevLoginAllowed(): void {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
  }

  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Returns a JWT for the student with this email (non-production).' })
  devLogin(@Body() dto: DevLoginDto): Promise<{ accessToken: string }> {
    this.assertDevLoginAllowed();
    return this.auth.devLogin(dto.email);
  }

  @Post('tutor/dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Returns a tutor JWT for the tutor with this email (non-production).',
  })
  tutorDevLogin(@Body() dto: DevLoginDto): Promise<{ accessToken: string; tutorId: string }> {
    this.assertDevLoginAllowed();
    return this.auth.tutorDevLogin(dto.email);
  }
}
