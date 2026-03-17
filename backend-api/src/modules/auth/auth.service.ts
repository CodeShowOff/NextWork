import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';

import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { EmailService } from '../../common/email/email.service';
import { InvitesService } from '../invites/invites.service';
import { UsersService } from '../users/users.service';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { SignUpDto } from './dto/sign-up.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SignUpResult {
  status: 'verification_required';
  email: string;
  expiresAt: string;
  debugCode?: string;
}

@Injectable()
export class AuthService {
  private readonly emailVerificationTtlMinutes = 30;
  private readonly passwordResetTtlMinutes = 15;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly invitesService: InvitesService,
  ) {}

  async signUp(payload: SignUpDto): Promise<SignUpResult> {
    const existing = await this.usersService.findByEmail(payload.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const resolvedDisplayName = payload.fullName?.trim() || payload.displayName?.trim();
    if (!resolvedDisplayName) {
      throw new BadRequestException('Display name or full name is required');
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const inviteToken = payload.inviteToken?.trim();
    let user;

    if (inviteToken) {
      const invite = await this.invitesService.getInviteByToken(inviteToken);
      if (invite.isExpired || invite.isRevoked || invite.isUsageExceeded) {
        throw new BadRequestException('Invite token is invalid or expired');
      }

      user = await this.usersService.createInvitedUser({
        email: payload.email,
        passwordHash,
        displayName: resolvedDisplayName,
        organizationSize: payload.organizationSize?.trim(),
        jobTitle: payload.jobTitle?.trim(),
      });

      try {
        await this.invitesService.acceptInvite(user.id, inviteToken);
      } catch (error) {
        await this.usersService.deleteUser(user.id);
        throw error;
      }
    } else {
      user = await this.usersService.createUser({
        email: payload.email,
        passwordHash,
        displayName: resolvedDisplayName,
        organizationName: payload.organizationName?.trim(),
        organizationSize: payload.organizationSize?.trim(),
        jobTitle: payload.jobTitle?.trim(),
      });
    }

    const verification = await this.issueEmailVerificationToken(user.id, user.email);

    return {
      status: 'verification_required',
      email: user.email,
      expiresAt: verification.expiresAt,
      ...(verification.debugCode ? { debugCode: verification.debugCode } : {}),
    };
  }

  async login(payload: LoginDto): Promise<AuthTokens> {
    const user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('User is not active');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email not verified. Please verify before logging in.');
    }

    const isValidPassword = await bcrypt.compare(payload.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user.id, user.email);
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const payload = await this.verifyRefreshToken(refreshToken);
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User is not active');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email not verified. Please verify before logging in.');
    }

    if (!user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(user.id, user.email);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshTokenHash(userId, null);
  }

  async resendEmailVerification(
    email: string,
  ): Promise<{ status: 'ok'; expiresAt: string | null; debugCode?: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { status: 'ok', expiresAt: null };
    }
    if (user.emailVerifiedAt) {
      return { status: 'ok', expiresAt: null };
    }

    const verification = await this.issueEmailVerificationToken(user.id, user.email);

    return {
      status: 'ok',
      expiresAt: verification.expiresAt,
      ...(verification.debugCode ? { debugCode: verification.debugCode } : {}),
    };
  }

  async verifyEmail(payload: VerifyEmailDto): Promise<{ status: 'ok' }> {
    const user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (user.emailVerifiedAt) {
      return { status: 'ok' };
    }

    if (!user.emailVerificationTokenHash || !user.emailVerificationTokenExpiresAt) {
      throw new BadRequestException('No verification token is active. Request a new one.');
    }

    if (user.emailVerificationTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification token expired. Request a new one.');
    }

    const hashedToken = this.hashToken(payload.token.trim());
    if (hashedToken !== user.emailVerificationTokenHash) {
      throw new UnauthorizedException('Invalid verification token');
    }

    await this.usersService.markEmailVerified(user.id);
    return { status: 'ok' };
  }

  async requestPasswordReset(
    email: string,
  ): Promise<{ status: 'ok'; expiresAt: string | null; debugCode?: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.emailVerifiedAt) {
      return { status: 'ok', expiresAt: null };
    }

    const token = this.generateNumericToken();
    const tokenHash = this.hashToken(token);
    const expiresAtDate = new Date(Date.now() + this.passwordResetTtlMinutes * 60_000);

    await this.usersService.setPasswordResetToken(user.id, tokenHash, expiresAtDate);
    await this.sendPasswordResetEmail(user.email, token, expiresAtDate);

    return {
      status: 'ok',
      expiresAt: expiresAtDate.toISOString(),
      ...(this.shouldExposeDebugAuthCode() ? { debugCode: token } : {}),
    };
  }

  async confirmPasswordReset(payload: ConfirmPasswordResetDto): Promise<{ status: 'ok' }> {
    const user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      throw new NotFoundException('Account not found');
    }

    if (!user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
      throw new BadRequestException('No reset request is active. Request a new reset code.');
    }

    if (user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Reset token expired. Request a new reset code.');
    }

    const hashedToken = this.hashToken(payload.token.trim());
    if (hashedToken !== user.passwordResetTokenHash) {
      throw new UnauthorizedException('Invalid reset token');
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);
    await this.usersService.updatePasswordHash(user.id, passwordHash);

    return { status: 'ok' };
  }

  private async issueTokens(userId: string, email: string): Promise<AuthTokens> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'access',
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      type: 'refresh',
    };

    const accessExpiresIn = this.configService.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN');
    const refreshExpiresIn = this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn as never,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as never,
      }),
    ]);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    await this.usersService.updateRefreshTokenHash(userId, refreshTokenHash);

    return { accessToken, refreshToken };
  }

  private verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  private async issueEmailVerificationToken(
    userId: string,
    email: string,
  ): Promise<{ expiresAt: string; debugCode?: string }> {
    const token = this.generateNumericToken();
    const tokenHash = this.hashToken(token);
    const expiresAtDate = new Date(Date.now() + this.emailVerificationTtlMinutes * 60_000);

    await this.usersService.setEmailVerificationToken(userId, tokenHash, expiresAtDate);
    await this.sendVerificationEmail(email, token, expiresAtDate);

    return {
      expiresAt: expiresAtDate.toISOString(),
      ...(this.shouldExposeDebugAuthCode() ? { debugCode: token } : {}),
    };
  }

  private generateNumericToken(): string {
    return randomInt(100000, 999999).toString();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private shouldExposeDebugAuthCode(): boolean {
    const value = this.configService.get<string>('AUTH_DEBUG_TOKEN_EXPOSE');
    if (!value) {
      return process.env.NODE_ENV !== 'production';
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private async sendVerificationEmail(
    email: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const expiry = expiresAt.toLocaleString();

    await this.emailService.sendTransactionalEmail({
      to: email,
      subject: 'Verify your Workplace email',
      htmlContent: `<p>Your Workplace verification code is <strong>${token}</strong>.</p><p>This code expires at ${expiry}.</p>`,
      textContent: `Your Workplace verification code is ${token}. It expires at ${expiry}.`,
    });
  }

  private async sendPasswordResetEmail(
    email: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    const expiry = expiresAt.toLocaleString();

    await this.emailService.sendTransactionalEmail({
      to: email,
      subject: 'Reset your Workplace password',
      htmlContent: `<p>Your Workplace password reset code is <strong>${token}</strong>.</p><p>This code expires at ${expiry}.</p>`,
      textContent: `Your Workplace password reset code is ${token}. It expires at ${expiry}.`,
    });
  }
}
