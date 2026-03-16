import { requestJson } from './http';

export interface Profile {
  userId: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  organizationSize: string | null;
  createdAt: string;
  updatedAt: string;
}

export function getProfile(userId: string) {
  return requestJson<Profile>(`/profiles/${userId}`);
}

export function updateMyProfile(payload: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  jobTitle?: string;
  organizationSize?: string;
}) {
  return requestJson<Profile>('/profiles/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
