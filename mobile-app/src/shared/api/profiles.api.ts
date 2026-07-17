import { requestJson } from './http';

export interface Profile {
  userId: string;
  email: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  organizationSize: string | null;
  createdAt: string;
  updatedAt: string;
  counters: {
    posts: number;
    followers: number;
    following: number;
    groupsFollowed: number;
    skillsEntries: number;
  };
  relationship: {
    isFollowing: boolean;
  };
  skills: Array<{ id: string; name: string }>;
}

export function replaceMySkills(skills: string[]) {
  return requestJson<{ items: Array<{ id: string; name: string }> }>('/profiles/me/skills', {
    method: 'PUT',
    body: JSON.stringify({ skills }),
  });
}

export function searchSkills(query: string) {
  const search = new URLSearchParams({ q: query });
  return requestJson<{ items: Array<{ name: string }> }>(`/profiles/skills/search?${search.toString()}`);
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
