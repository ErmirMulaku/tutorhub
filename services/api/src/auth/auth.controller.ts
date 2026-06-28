import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { DevLoginDto } from './dto/dev-login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Returns a JWT for the student with this email.' })
  devLogin(@Body() dto: DevLoginDto): Promise<{ accessToken: string }> {
    return this.auth.devLogin(dto.email);
  }

  @Post('tutor/dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Returns a tutor JWT for the tutor with this email.' })
  tutorDevLogin(@Body() dto: DevLoginDto): Promise<{ accessToken: string; tutorId: string }> {
    return this.auth.tutorDevLogin(dto.email);
  }
}
