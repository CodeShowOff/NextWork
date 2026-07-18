import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { CreateInviteLinkDto } from './dto/create-invite-link.dto';
import { InvitesRepository } from './invites.repository';

@Injectable()
export class InvitesService {
  constructor(private readonly invitesRepository: InvitesRepository) {}

  private buildInviteUrl(token: string): string {
    const configuredBase = process.env.INVITE_LINK_BASE_URL?.trim();
    if (!configuredBase) {
      return `nextwork://invite/${token}`;
    }

    if (configuredBase.includes('{token}')) {
      return configuredBase.replace('{token}', token);
    }

    const normalizedBase = configuredBase.replace(/\/+$/, '');
    return `${normalizedBase}/${token}`;
  }

  async createInviteLink(userId: string, payload: CreateInviteLinkDto): Promise<{
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
  }> {
    const membership = await this.invitesRepository.findOrganizationMembership(
      userId,
      payload.organizationId,
    );
    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new ForbiddenException('Only owners and admins can create invite links');
    }

    const expiresAt = payload.expiresInHours
      ? new Date(Date.now() + payload.expiresInHours * 60 * 60 * 1000)
      : undefined;

    const invite = await this.invitesRepository.createInvite({
      organizationId: payload.organizationId,
      createdBy: userId,
      token: randomBytes(16).toString('hex'),
      maxUses: payload.maxUses,
      expiresAt,
    });

    return {
      id: invite.id,
      token: invite.token,
      inviteUrl: this.buildInviteUrl(invite.token),
      organization: invite.organization,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    };
  }

  async getInviteByToken(token: string): Promise<{
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
  }> {
    const invite = await this.invitesRepository.findByToken(token);
    if (!invite) {
      throw new NotFoundException('Invite link not found');
    }

    const now = Date.now();
    const isExpired = invite.expiresAt ? invite.expiresAt.getTime() < now : false;
    const isRevoked = Boolean(invite.revokedAt);
    const isUsageExceeded = invite.maxUses ? invite.usedCount >= invite.maxUses : false;

    return {
      id: invite.id,
      organization: invite.organization,
      isExpired,
      isRevoked,
      isUsageExceeded,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    };
  }

  async acceptInvite(userId: string, token: string): Promise<{
    status: 'ok';
    organizationId: string;
    alreadyMember: boolean;
  }> {
    const invite = await this.invitesRepository.findByToken(token);
    if (!invite) {
      throw new NotFoundException('Invite link not found');
    }

    if (invite.revokedAt) {
      throw new ForbiddenException('Invite link was revoked');
    }

    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('Invite link has expired');
    }

    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      throw new ForbiddenException('Invite link has reached max usage');
    }

    const result = await this.invitesRepository.acceptInvite({ token, userId });

    return {
      status: 'ok',
      organizationId: result.organizationId,
      alreadyMember: result.alreadyMember,
    };
  }
}
