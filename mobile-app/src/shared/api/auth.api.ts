import type {
  AuthTokensDto,
  SignUpRequestDto,
  SignUpResultDto,
} from '@nextwork/api-contracts';

import { nextworkApi } from './contracts-client';

export type AuthTokens = AuthTokensDto;
export type SignUpResult = SignUpResultDto;
export type SignUpPayload = SignUpRequestDto;

export function login(payload: { email: string; password: string }) {
  return nextworkApi.auth.login(payload);
}

export function signUp(payload: SignUpPayload) {
  return nextworkApi.auth.signUp(payload);
}

export function verifyEmail(payload: { email: string; token: string }) {
  return nextworkApi.auth.verifyEmail(payload);
}

export function resendVerification(payload: { email: string }) {
  return nextworkApi.auth.resendVerification(payload);
}

export function requestPasswordReset(payload: { email: string }) {
  return nextworkApi.auth.requestPasswordReset(payload);
}

export function confirmPasswordReset(payload: {
  email: string;
  token: string;
  newPassword: string;
}) {
  return nextworkApi.auth.confirmPasswordReset(payload);
}
