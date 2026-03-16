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
