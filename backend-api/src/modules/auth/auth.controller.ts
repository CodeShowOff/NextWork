import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { RateLimit } from '../../common/reliability/rate-limit.decorator';
import { AuthService, type AuthTokens } from './auth.service';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @RateLimit(20, 60)
  @ApiOperation({ summary: 'Sign up user account' })
  @ApiBody({ type: SignUpDto })
  @ApiOkResponse({ description: 'Sign-up accepted with verification challenge details' })
  signUp(@Body() payload: SignUpDto): Promise<{
    status: 'verification_required';
    email: string;
    expiresAt: string;
    debugCode?: string;
  }> {
    // Sign-up accepts enriched onboarding fields through SignUpDto.
    return this.authService.signUp(payload);
  }

  @Post('verify-email')
  @RateLimit(20, 60)
  @ApiOperation({ summary: 'Verify email token' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiOkResponse({ description: 'Email verification success status' })
  verifyEmail(@Body() payload: VerifyEmailDto): Promise<{ status: 'ok' }> {
    return this.authService.verifyEmail(payload);
  }

  @Post('resend-verification')
  @RateLimit(10, 60)
  @ApiOperation({ summary: 'Resend email verification code' })
  @ApiBody({ type: RequestEmailVerificationDto })
  @ApiOkResponse({ description: 'Verification resend status and expiration data' })
  resendVerification(
    @Body() payload: RequestEmailVerificationDto,
  ): Promise<{ status: 'ok'; expiresAt: string | null; debugCode?: string }> {
    return this.authService.resendEmailVerification(payload.email);
  }

  @Post('forgot-password')
  @RateLimit(10, 60)
  @ApiOperation({ summary: 'Request password reset token' })
  @ApiBody({ type: RequestPasswordResetDto })
  @ApiOkResponse({ description: 'Password reset request status and expiration data' })
  requestPasswordReset(
    @Body() payload: RequestPasswordResetDto,
  ): Promise<{ status: 'ok'; expiresAt: string | null; debugCode?: string }> {
    return this.authService.requestPasswordReset(payload.email);
  }

  @Post('reset-password')
  @RateLimit(20, 60)
  @ApiOperation({ summary: 'Confirm password reset with token' })
  @ApiBody({ type: ConfirmPasswordResetDto })
  @ApiOkResponse({ description: 'Password reset confirmation status' })
  confirmPasswordReset(@Body() payload: ConfirmPasswordResetDto): Promise<{ status: 'ok' }> {
    return this.authService.confirmPasswordReset(payload);
  }

  @Post('login')
  @RateLimit(20, 60)
  @ApiOperation({ summary: 'Authenticate user and issue tokens' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'JWT access and refresh tokens' })
  login(@Body() payload: LoginDto): Promise<AuthTokens> {
    return this.authService.login(payload);
  }

  @Post('refresh')
  @RateLimit(40, 60)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({ description: 'Refreshed JWT access and refresh tokens' })
  refresh(@Body() payload: RefreshTokenDto): Promise<AuthTokens> {
    return this.authService.refreshToken(payload.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invalidate user session' })
  @ApiOkResponse({ description: 'Logout status' })
  async logout(@CurrentUser() user: JwtPayload): Promise<{ success: true }> {
    await this.authService.logout(user.sub);
    return { success: true };
  }
}
