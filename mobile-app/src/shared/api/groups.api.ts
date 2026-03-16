import { requestJson } from './http';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
}

export interface GroupMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
}

export function listGroups(organizationId: string) {
  const search = new URLSearchParams({ organizationId });
  return requestJson<{ items: Group[] }>(`/groups?${search.toString()}`);
}

export function createGroup(payload: { organizationId: string; name: string; description?: string }) {
  return requestJson<Group>('/groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function joinGroup(groupId: string) {
  return requestJson<{ status: 'ok' }>(`/groups/${groupId}/join`, {
    method: 'POST',
  });
}

export function listGroupMembers(groupId: string) {
  return requestJson<{ groupId: string; items: GroupMember[] }>(`/groups/${groupId}/members`);
}
