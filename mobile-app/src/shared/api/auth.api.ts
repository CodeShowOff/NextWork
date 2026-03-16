import { requestJson } from './http';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function login(payload: { email: string; password: string }) {
  return requestJson<AuthTokens>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function signUp(payload: { email: string; password: string; displayName: string }) {
  return requestJson<AuthTokens>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
