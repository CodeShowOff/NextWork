import type {
  AuthTokensDto,
  SignUpRequestDto,
  SignUpResultDto,
} from '@workplace/api-contracts';

import { workplaceApi } from './contracts-client';

export type AuthTokens = AuthTokensDto;
export type SignUpResult = SignUpResultDto;
export type SignUpPayload = SignUpRequestDto;

export function login(payload: { email: string; password: string }) {
  return workplaceApi.auth.login(payload);
}

export function signUp(payload: SignUpPayload) {
  return workplaceApi.auth.signUp(payload);
}

export function verifyEmail(payload: { email: string; token: string }) {
  return workplaceApi.auth.verifyEmail(payload);
}

export function resendVerification(payload: { email: string }) {
  return workplaceApi.auth.resendVerification(payload);
}

export function requestPasswordReset(payload: { email: string }) {
  return workplaceApi.auth.requestPasswordReset(payload);
}

export function confirmPasswordReset(payload: {
  email: string;
  token: string;
  newPassword: string;
}) {
  return workplaceApi.auth.confirmPasswordReset(payload);
}
