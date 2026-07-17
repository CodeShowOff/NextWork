import { GroupMembershipRequestStatus, GroupRole, Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

export interface GroupRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  groupType: string;
  groupPrivacy: string;
  photoUrl: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const groupSelect = {
  id: true,
  organizationId: true,
  name: true,
  description: true,
  groupType: true,
  groupPrivacy: true,
  photoUrl: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GroupSelect;

@Injectable()
export class GroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listGroups(organizationId: string) {
    return this.prisma.group.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        ...groupSelect,
        _count: { select: { members: true } },
      },
    });
  }

  findGroupById(groupId: string): Promise<GroupRecord | null> {
    return this.prisma.group.findUnique({
      where: { id: groupId },
      select: groupSelect,
    });
  }

  findGroupWithCount(groupId: string) {
    return this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        ...groupSelect,
        _count: { select: { members: true } },
      },
    });
  }

  createGroup(params: {
    organizationId: string;
    createdBy: string;
    name: string;
    description?: string;
    groupType: string;
    groupPrivacy: string;
    photoUrl?: string;
  }) {
    return this.prisma.group.create({
      data: {
        organizationId: params.organizationId,
        createdBy: params.createdBy,
        name: params.name,
        description: params.description,
        groupType: params.groupType,
        groupPrivacy: params.groupPrivacy,
        photoUrl: params.photoUrl,
        members: {
          create: {
            userId: params.createdBy,
            role: GroupRole.owner,
          },
        },
      },
      select: {
        ...groupSelect,
        _count: { select: { members: true } },
      },
    });
  }

  findOrganizationMembership(userId: string, organizationId: string): Promise<boolean> {
    return this.prisma.organizationMember
      .findUnique({
        where: { organizationId_userId: { organizationId, userId } },
        select: { userId: true },
      })
      .then((row) => Boolean(row));
  }

  findOrganizationMembershipWithRole(userId: string, organizationId: string) {
    return this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
  }

  findGroupMembership(userId: string, groupId: string) {
    return this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
      select: {
        userId: true,
        role: true,
        isFavorite: true,
        lastVisitedAt: true,
        joinedAt: true,
      },
    });
  }

  joinGroup(userId: string, groupId: string, role: GroupRole = GroupRole.member): Promise<void> {
    return this.prisma.groupMember
      .upsert({
        where: { groupId_userId: { groupId, userId } },
        create: { groupId, userId, role },
        update: {},
      })
      .then(() => undefined);
  }

  updateGroupMembershipRole(groupId: string, userId: string, role: GroupRole) {
    return this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: { role },
      select: { groupId: true, userId: true, role: true },
    });
  }

  updateGroupMemberPreferences(groupId: string, userId: string, data: { isFavorite?: boolean; visit?: boolean }) {
    return this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId } },
      data: {
        ...(data.isFavorite === undefined ? {} : { isFavorite: data.isFavorite }),
        ...(data.visit ? { lastVisitedAt: new Date() } : {}),
      },
      select: { isFavorite: true, lastVisitedAt: true },
    });
  }

  updateGroup(
    groupId: string,
    payload: { name?: string; description?: string | null; groupType?: string; groupPrivacy?: string; photoUrl?: string | null },
  ) {
    return this.prisma.group.update({
      where: { id: groupId },
      data: payload,
      select: groupSelect,
    });
  }

  async deleteGroupWithPostPolicy(
    groupId: string,
    postPolicy: 'detach' | 'remove',
  ): Promise<{ affectedPosts: number }> {
    return this.prisma.$transaction(async (tx) => {
      const affectedPosts =
        postPolicy === 'remove'
          ? (await tx.post.deleteMany({ where: { groupId } })).count
          : (await tx.post.updateMany({ where: { groupId }, data: { groupId: null } })).count;

      await tx.group.delete({ where: { id: groupId } });
      return { affectedPosts };
    });
  }

  listMembers(groupId: string) {
    return this.prisma.groupMember.findMany({
      where: { groupId },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      select: {
        userId: true,
        role: true,
        joinedAt: true,
        user: {
          select: {
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  findGroupByOrganizationAndName(organizationId: string, name: string) {
    return this.prisma.group.findFirst({
      where: { organizationId, name },
      select: groupSelect,
    });
  }

  async ensureStarterGroup(params: {
    organizationId: string;
    createdBy: string;
    name: string;
    description: string;
    groupType: string;
    groupPrivacy: string;
    photoUrl?: string;
  }): Promise<{ id: string; name: string }> {
    const existing = await this.findGroupByOrganizationAndName(params.organizationId, params.name);
    if (existing) {
      await this.joinGroup(params.createdBy, existing.id);
      return { id: existing.id, name: existing.name };
    }

    const created = await this.createGroup(params);
    return { id: created.id, name: created.name };
  }

  getOnboardingAudit(organizationId: string) {
    return this.prisma.organizationOnboardingAudit.findUnique({
      where: { organizationId },
      select: {
        organizationId: true,
        initializedBy: true,
        initializedAt: true,
        skipped: true,
        selectedKeys: true,
      },
    });
  }

  upsertOnboardingAudit(params: {
    organizationId: string;
    initializedBy: string;
    skipped: boolean;
    selectedKeys: string[];
  }): Promise<void> {
    return this.prisma.organizationOnboardingAudit
      .upsert({
        where: { organizationId: params.organizationId },
        create: params,
        update: {},
      })
      .then(() => undefined);
  }

  createMembershipRequest(params: { groupId: string; requesterId: string; message?: string }) {
    return this.prisma.groupMembershipRequest.upsert({
      where: { groupId_requesterId: { groupId: params.groupId, requesterId: params.requesterId } },
      create: {
        groupId: params.groupId,
        requesterId: params.requesterId,
        message: params.message,
      },
      update: {
        message: params.message,
        status: 'pending',
        resolvedById: null,
        resolvedAt: null,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  listMembershipRequests(groupId: string) {
    return this.prisma.groupMembershipRequest.findMany({
      where: { groupId, status: GroupMembershipRequestStatus.pending },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        requesterId: true,
        message: true,
        status: true,
        createdAt: true,
        requester: {
          select: { profile: { select: { displayName: true, avatarUrl: true } } },
        },
      },
    });
  }

  findMembershipRequest(requestId: string) {
    return this.prisma.groupMembershipRequest.findUnique({
      where: { id: requestId },
      select: { id: true, groupId: true, requesterId: true, status: true },
    });
  }

  resolveMembershipRequest(params: {
    requestId: string;
    status: 'approved' | 'declined';
    resolvedById: string;
  }): Promise<void> {
    return this.prisma.groupMembershipRequest
      .update({
        where: { id: params.requestId },
        data: {
          status: params.status,
          resolvedById: params.resolvedById,
          resolvedAt: new Date(),
        },
      })
      .then(() => undefined);
  }

  createInvitation(params: { groupId: string; invitedUserId: string; invitedById: string }) {
    return this.prisma.groupInvitation.upsert({
      where: { groupId_invitedUserId: { groupId: params.groupId, invitedUserId: params.invitedUserId } },
      create: params,
      update: { invitedById: params.invitedById, status: 'pending' },
      select: { id: true, groupId: true, invitedUserId: true, status: true, createdAt: true },
    });
  }

  listInvitationsForUser(userId: string) {
    return this.prisma.groupInvitation.findMany({
      where: { invitedUserId: userId, status: 'pending' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        groupId: true,
        status: true,
        createdAt: true,
        group: { select: groupSelect },
        invitedBy: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
  }

  findInvitation(invitationId: string) {
    return this.prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      select: { id: true, groupId: true, invitedUserId: true, status: true },
    });
  }

  respondToInvitation(invitationId: string, status: 'accepted' | 'declined'): Promise<void> {
    return this.prisma.groupInvitation
      .update({ where: { id: invitationId }, data: { status } })
      .then(() => undefined);
  }

  listMediaStorageKeys(groupId: string): Promise<string[]> {
    return this.prisma.mediaObject
      .findMany({ where: { groupId }, select: { storageKey: true } })
      .then((rows) => rows.map((row) => row.storageKey));
  }
}
