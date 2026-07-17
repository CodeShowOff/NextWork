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
  organizationId?: string;
  membership?: {
    role: 'owner' | 'admin' | 'member';
    isFavorite: boolean;
    lastVisitedAt: string | null;
  } | null;
  canManage?: boolean;
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
  role?: 'owner' | 'admin' | 'member';
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
  return requestJson<{ status: 'joined' | 'requested' }>(`/groups/${groupId}/join`, {
    method: 'POST',
  });
}

export function getGroup(groupId: string) {
  return requestJson<Group>(`/groups/${groupId}`);
}

export function requestGroupMembership(groupId: string, message?: string) {
  return requestJson<{ status: 'joined' | 'requested' }>(`/groups/${groupId}/requests`, {
    method: 'POST',
    body: JSON.stringify({ ...(message?.trim() ? { message: message.trim() } : {}) }),
  });
}

export function setGroupFavorite(groupId: string, isFavorite: boolean) {
  return requestJson<{ isFavorite: boolean }>(`/groups/${groupId}/favorite`, {
    method: 'PATCH',
    body: JSON.stringify({ isFavorite }),
  });
}

export function recordGroupVisit(groupId: string) {
  return requestJson<{ lastVisitedAt: string | null }>(`/groups/${groupId}/visit`, { method: 'POST' });
}

export function listGroupMembershipRequests(groupId: string) {
  return requestJson<{
    groupId: string;
    items: Array<{
      id: string;
      requesterId: string;
      message: string | null;
      status: string;
      createdAt: string;
      requester: { displayName: string; avatarUrl: string | null };
    }>;
  }>(`/groups/${groupId}/requests`);
}

export function resolveGroupMembershipRequest(groupId: string, requestId: string, action: 'approve' | 'decline') {
  return requestJson<{ status: 'ok' }>(`/groups/${groupId}/requests/${requestId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export function updateGroupMemberRole(groupId: string, memberUserId: string, role: 'owner' | 'admin' | 'member') {
  return requestJson<{ userId: string; role: string }>(`/groups/${groupId}/members/${memberUserId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function createGroupInvitation(groupId: string, invitedUserId: string) {
  return requestJson<{ id: string; groupId: string; invitedUserId: string; status: string }>(`/groups/${groupId}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ invitedUserId }),
  });
}

export function listMyGroupInvitations() {
  return requestJson<{ items: Array<{ id: string; groupId: string; status: string; group: { id: string; name: string; description: string | null }; invitedBy: { id: string; displayName: string; avatarUrl: string | null } }> }>('/groups/invitations/mine');
}

export function respondGroupInvitation(invitationId: string, accept: boolean) {
  return requestJson<{ status: 'ok'; groupId: string }>(`/groups/invitations/${invitationId}/respond`, { method: 'POST', body: JSON.stringify({ accept }) });
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
