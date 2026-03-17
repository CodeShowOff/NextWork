import { requestJson } from './http';

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

export interface SignUpPayload {
  email: string;
  password: string;
  displayName: string;
  fullName: string;
  organizationName: string;
  organizationSize: string;
  jobTitle: string;
  inviteToken?: string;
}

export function login(payload: { email: string; password: string }) {
  return requestJson<AuthTokens>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function signUp(payload: SignUpPayload) {
  return requestJson<SignUpResult>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyEmail(payload: { email: string; token: string }) {
  return requestJson<{ status: 'ok' }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function resendVerification(payload: { email: string }) {
  return requestJson<{ status: 'ok'; expiresAt: string | null; debugCode?: string }>(
    '/auth/resend-verification',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function requestPasswordReset(payload: { email: string }) {
  return requestJson<{ status: 'ok'; expiresAt: string | null; debugCode?: string }>(
    '/auth/forgot-password',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export function confirmPasswordReset(payload: {
  email: string;
  token: string;
  newPassword: string;
}) {
  return requestJson<{ status: 'ok' }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
