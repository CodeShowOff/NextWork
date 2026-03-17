import { requestJson } from './http';

export interface OrganizationMembership {
  organizationId: string;
  role: string;
  joinedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    memberCount: number;
    groupCount: number;
  };
}

export function onboardOrganization(payload: { name: string }) {
  return requestJson<{ organizationId: string }>('/organizations/onboard', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listMyOrganizations() {
  return requestJson<{ items: OrganizationMembership[] }>('/organizations/me');
}

export function switchOrganization(organizationId: string) {
  return requestJson<{ status: 'ok' }>(`/organizations/${organizationId}/switch`, {
    method: 'POST',
  });
}

export function updateOrganization(organizationId: string, payload: { name?: string }) {
  return requestJson<{
    organizationId: string;
    name: string;
    slug: string;
    updatedAt: string;
  }>(`/organizations/${organizationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function deactivateOrganization(organizationId: string) {
  return requestJson<{
    status: 'ok';
    organizationId: string;
    deactivated: true;
    affectedMembers: number;
    affectedGroups: number;
  }>(`/organizations/${organizationId}/deactivate`, {
    method: 'POST',
  });
}

export function deleteOrganization(organizationId: string) {
  return requestJson<{
    status: 'ok';
    organizationId: string;
    deleted: true;
    deletedPostCount: number;
  }>(`/organizations/${organizationId}`, {
    method: 'DELETE',
  });
}
