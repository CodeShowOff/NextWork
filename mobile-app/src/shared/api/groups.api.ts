import { requestJson } from './http';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  groupType: string;
  groupPrivacy: string;
  photoUrl: string | null;
  createdAt: string;
  memberCount: number;
}

export interface StarterGroupCatalogItem {
  key: string;
  name: string;
  description: string;
}

export interface StarterGroupsConfig {
  organizationId: string;
  onboardingCompleted: boolean;
  initializedAt: string | null;
  skipped: boolean;
  selectedKeys: string[];
  catalog: StarterGroupCatalogItem[];
}

export interface StarterGroupsInitializationResult {
  organizationId: string;
  onboardingCompleted: boolean;
  alreadyInitialized: boolean;
  skipped: boolean;
  createdGroupIds: string[];
  selectedKeys: string[];
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

export function getStarterGroupsConfig(organizationId: string) {
  const search = new URLSearchParams({ organizationId });
  return requestJson<StarterGroupsConfig>(`/groups/onboarding/defaults?${search.toString()}`);
}

export function initializeStarterGroups(payload: {
  organizationId: string;
  selectedKeys: string[];
  skipped?: boolean;
}) {
  return requestJson<StarterGroupsInitializationResult>('/groups/onboarding/initialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createGroup(payload: {
  organizationId: string;
  name: string;
  description?: string;
  groupType?: string;
  groupPrivacy?: string;
  photoUrl?: string;
}) {
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

export function updateGroup(
  groupId: string,
  payload: { name?: string; description?: string; groupType?: string; groupPrivacy?: string; photoUrl?: string },
) {
  return requestJson<{
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    groupType: string;
    groupPrivacy: string;
    photoUrl: string | null;
    updatedAt: string;
  }>(`/groups/${groupId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deleteGroup(groupId: string, payload?: { postPolicy?: 'detach' | 'remove' }) {
  return requestJson<{
    status: 'ok';
    groupId: string;
    postPolicy: 'detach' | 'remove';
    affectedPosts: number;
  }>(`/groups/${groupId}`, {
    method: 'DELETE',
    body: JSON.stringify(payload ?? {}),
  });
}
