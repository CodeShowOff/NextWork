import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { RateLimit } from '../../common/reliability/rate-limit.decorator';
import { AuthService, type AuthTokens } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/sign-up.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @RateLimit(20, 60)
  signUp(@Body() payload: SignUpDto): Promise<AuthTokens> {
    // Sign-up accepts enriched onboarding fields through SignUpDto.
    return this.authService.signUp(payload);
  }

  @Post('login')
  @RateLimit(20, 60)
  login(@Body() payload: LoginDto): Promise<AuthTokens> {
    return this.authService.login(payload);
  }

  @Post('refresh')
  @RateLimit(40, 60)
  refresh(@Body() payload: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refreshToken(payload.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: JwtPayload): Promise<{ success: true }> {
    await this.authService.logout(user.sub);
    return { success: true };
  }
}
