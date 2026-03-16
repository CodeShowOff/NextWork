import { requestJson } from './http';

export interface CurrentUser {
  id: string;
  email: string;
  status: string;
  activeOrganizationId: string | null;
}

export function getCurrentUser() {
  return requestJson<CurrentUser>('/users/me');
}
