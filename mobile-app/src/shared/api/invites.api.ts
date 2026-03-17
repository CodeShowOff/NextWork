import { requestJson } from './http';

export interface InviteSummary {
  id: string;
  token: string;
  inviteUrl: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
}

export interface InviteDetails {
  id: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  isExpired: boolean;
  isRevoked: boolean;
  isUsageExceeded: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
}

export function createInviteLink(payload: {
  organizationId: string;
  maxUses?: number;
  expiresInHours?: number;
}) {
  return requestJson<InviteSummary>('/invites', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getInviteByToken(token: string) {
  return requestJson<InviteDetails>(`/invites/${token}`);
}

export function acceptInvite(token: string) {
  return requestJson<{ status: 'ok'; organizationId: string; alreadyMember: boolean }>(
    `/invites/${token}/accept`,
    {
      method: 'POST',
    },
  );
}
