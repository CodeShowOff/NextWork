import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GroupRole } from '@prisma/client';

import { MediaService } from '../media/media.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { DeleteGroupDto } from './dto/delete-group.dto';
import { InitializeStarterGroupsDto } from './dto/initialize-starter-groups.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { DEFAULT_GROUP_PRIVACY, DEFAULT_GROUP_TYPE } from './groups.constants';
import { GroupRecord, GroupsRepository } from './groups.repository';

export interface GroupView {
  id: string;
  organizationId?: string;
  name: string;
  description: string | null;
  groupType: string;
  groupPrivacy: string;
  photoUrl: string | null;
  createdAt: string;
  memberCount: number;
  membership: {
    role: GroupRole;
    isFavorite: boolean;
    lastVisitedAt: string | null;
  } | null;
  canManage: boolean;
}

export interface GroupAccess {
  group: GroupRecord;
  organizationRole: string;
  membership: {
    role: GroupRole;
    isFavorite: boolean;
    lastVisitedAt: Date | null;
    joinedAt: Date;
  } | null;
  canManage: boolean;
}

const starterGroupCatalog = [
  {
    key: 'company-announcements',
    name: 'Company Announcements',
    description: 'Important updates for all members.',
    groupType: 'Announcements',
    groupPrivacy: 'Open',
  },
  {
    key: 'marketing-team',
    name: 'Marketing Team',
    description: 'Campaign planning and brand work.',
    groupType: 'Discussions',
    groupPrivacy: 'Open',
  },
  {
    key: 'company-social',
    name: 'Company Social',
    description: 'Casual social updates and celebrations.',
    groupType: 'Social & More',
    groupPrivacy: 'Open',
  },
  {
    key: 'project-updates',
    name: 'Project Updates',
    description: 'Status tracking for cross-team projects.',
    groupType: 'Announcements',
    groupPrivacy: 'Open',
  },
  {
    key: 'general',
    name: 'General',
    description: 'Open discussion space for everyone.',
    groupType: 'Teams & Projects',
    groupPrivacy: 'Open',
  },
] as const;

const mandatoryStarterGroupKey = 'general';

@Injectable()
export class GroupsService {
  constructor(
    private readonly groupsRepository: GroupsRepository,
    private readonly mediaService?: MediaService,
  ) {}

  private canManageOrganization(role: string): boolean {
    return role === 'owner' || role === 'admin';
  }

  private canManageGroup(organizationRole: string, groupRole?: GroupRole): boolean {
    return this.canManageOrganization(organizationRole) || groupRole === GroupRole.owner || groupRole === GroupRole.admin;
  }

  private toGroupView(
    group: {
      id: string;
      organizationId: string;
      name: string;
      description: string | null;
      groupType: string;
      groupPrivacy: string;
      photoUrl: string | null;
      createdAt: Date;
      _count: { members: number };
    },
    membership: GroupAccess['membership'],
    organizationRole: string,
  ): GroupView {
    return {
      id: group.id,
      organizationId: group.organizationId,
      name: group.name,
      description: group.description,
      groupType: group.groupType,
      groupPrivacy: group.groupPrivacy,
      photoUrl: group.photoUrl,
      createdAt: group.createdAt.toISOString(),
      memberCount: group._count.members,
      membership: membership
        ? {
            role: membership.role,
            isFavorite: membership.isFavorite,
            lastVisitedAt: membership.lastVisitedAt?.toISOString() ?? null,
          }
        : null,
      canManage: this.canManageGroup(organizationRole, membership?.role),
    };
  }

  async getGroupAccess(userId: string, groupId: string, options?: { requireMember?: boolean }): Promise<GroupAccess> {
    const group = await this.groupsRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const organizationMembership = await this.groupsRepository.findOrganizationMembershipWithRole(
      userId,
      group.organizationId,
    );
    if (!organizationMembership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const findGroupMembership = (this.groupsRepository as Partial<GroupsRepository>).findGroupMembership;
    const membership = findGroupMembership ? await findGroupMembership.call(this.groupsRepository, userId, groupId) : null;
    const isOrganizationManager = this.canManageOrganization(organizationMembership.role);
    if (group.groupPrivacy === 'Secret' && !membership && !isOrganizationManager) {
      // Secret groups are intentionally indistinguishable from missing groups to non-members.
      throw new NotFoundException('Group not found');
    }

    if (options?.requireMember && !membership && !isOrganizationManager) {
      throw new ForbiddenException('Join this group before accessing its resources');
    }

    return {
      group,
      organizationRole: organizationMembership.role,
      membership,
      canManage: this.canManageGroup(organizationMembership.role, membership?.role),
    };
  }

  async listGroups(userId: string, organizationId: string): Promise<{ items: GroupView[] }> {
    const organizationMembership = await this.groupsRepository.findOrganizationMembershipWithRole(userId, organizationId);
    if (!organizationMembership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const groups = await this.groupsRepository.listGroups(organizationId);
    const memberships = await Promise.all(groups.map((group) => this.groupsRepository.findGroupMembership(userId, group.id)));
    const isOrganizationManager = this.canManageOrganization(organizationMembership.role);

    return {
      items: groups
        .map((group, index) => ({ group, membership: memberships[index] ?? null }))
        .filter(({ group, membership }) => group.groupPrivacy !== 'Secret' || Boolean(membership) || isOrganizationManager)
        .map(({ group, membership }) => this.toGroupView(group, membership, organizationMembership.role)),
    };
  }

  async getGroup(userId: string, groupId: string): Promise<GroupView> {
    const access = await this.getGroupAccess(userId, groupId);
    const group = await this.groupsRepository.findGroupWithCount(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return this.toGroupView(group, access.membership, access.organizationRole);
  }

  async createGroup(userId: string, payload: CreateGroupDto): Promise<GroupView> {
    const membership = await this.groupsRepository.findOrganizationMembership(userId, payload.organizationId);
    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const group = await this.groupsRepository.createGroup({
      organizationId: payload.organizationId,
      createdBy: userId,
      name: payload.name.trim(),
      description: payload.description?.trim() || undefined,
      groupType: payload.groupType ?? DEFAULT_GROUP_TYPE,
      groupPrivacy: payload.groupPrivacy ?? DEFAULT_GROUP_PRIVACY,
      photoUrl: payload.photoUrl?.trim() || undefined,
    });

    return this.toGroupView(
      group,
      { role: GroupRole.owner, isFavorite: false, lastVisitedAt: null, joinedAt: new Date() },
      'member',
    );
  }

  async joinGroup(userId: string, groupId: string): Promise<{ status: 'joined' | 'requested' }> {
    const access = await this.getGroupAccess(userId, groupId);
    if (access.membership) {
      return { status: 'joined' };
    }

    if (access.group.groupPrivacy === 'Secret') {
      throw new ForbiddenException('Secret groups are invite-only');
    }

    if (access.group.groupPrivacy === 'Closed') {
      await this.groupsRepository.createMembershipRequest({ groupId, requesterId: userId });
      return { status: 'requested' };
    }

    await this.groupsRepository.joinGroup(userId, groupId);
    return { status: 'joined' };
  }

  async requestMembership(userId: string, groupId: string, message?: string): Promise<{ status: 'joined' | 'requested' }> {
    const access = await this.getGroupAccess(userId, groupId);
    if (access.membership) {
      return { status: 'joined' };
    }
    if (access.group.groupPrivacy === 'Secret') {
      throw new ForbiddenException('Secret groups are invite-only');
    }
    if (access.group.groupPrivacy === 'Open') {
      await this.groupsRepository.joinGroup(userId, groupId);
      return { status: 'joined' };
    }
    await this.groupsRepository.createMembershipRequest({ groupId, requesterId: userId, message: message?.trim() || undefined });
    return { status: 'requested' };
  }

  async listMembershipRequests(userId: string, groupId: string) {
    const access = await this.getGroupAccess(userId, groupId, { requireMember: true });
    if (!access.canManage) {
      throw new ForbiddenException('Only group administrators can review requests');
    }
    const items = await this.groupsRepository.listMembershipRequests(groupId);
    return {
      groupId,
      items: items.map((item) => ({
        id: item.id,
        requesterId: item.requesterId,
        message: item.message,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        requester: {
          displayName: item.requester.profile?.displayName ?? 'Unknown',
          avatarUrl: item.requester.profile?.avatarUrl ?? null,
        },
      })),
    };
  }

  async resolveMembershipRequest(
    userId: string,
    groupId: string,
    requestId: string,
    action: 'approve' | 'decline',
  ): Promise<{ status: 'ok' }> {
    const access = await this.getGroupAccess(userId, groupId, { requireMember: true });
    if (!access.canManage) {
      throw new ForbiddenException('Only group administrators can resolve requests');
    }
    const request = await this.groupsRepository.findMembershipRequest(requestId);
    if (!request || request.groupId !== groupId) {
      throw new NotFoundException('Membership request not found');
    }
    if (request.status === 'pending' && action === 'approve') {
      await this.groupsRepository.joinGroup(request.requesterId, groupId);
    }
    if (request.status === 'pending') {
      await this.groupsRepository.resolveMembershipRequest({
        requestId,
        status: action === 'approve' ? 'approved' : 'declined',
        resolvedById: userId,
      });
    }
    return { status: 'ok' };
  }

  async createInvitation(userId: string, groupId: string, invitedUserId: string) {
    const access = await this.getGroupAccess(userId, groupId, { requireMember: true });
    if (!access.canManage) {
      throw new ForbiddenException('Only group administrators can invite people');
    }
    const isOrganizationMember = await this.groupsRepository.findOrganizationMembership(
      invitedUserId,
      access.group.organizationId,
    );
    if (!isOrganizationMember) {
      throw new BadRequestException('Invited person must belong to this organization');
    }
    if (invitedUserId === userId) {
      throw new BadRequestException('You cannot invite yourself');
    }
    return this.groupsRepository.createInvitation({ groupId, invitedUserId, invitedById: userId });
  }

  async listMyInvitations(userId: string) {
    const invitations = await this.groupsRepository.listInvitationsForUser(userId);
    return {
      items: invitations.map((invitation) => ({
        id: invitation.id,
        groupId: invitation.groupId,
        status: invitation.status,
        createdAt: invitation.createdAt.toISOString(),
        group: {
          id: invitation.group.id,
          name: invitation.group.name,
          description: invitation.group.description,
          groupPrivacy: invitation.group.groupPrivacy,
        },
        invitedBy: {
          displayName: invitation.invitedBy.profile?.displayName ?? 'Unknown',
          avatarUrl: invitation.invitedBy.profile?.avatarUrl ?? null,
        },
      })),
    };
  }

  async respondToInvitation(userId: string, invitationId: string, accept: boolean): Promise<{ status: 'ok' }> {
    const invitation = await this.groupsRepository.findInvitation(invitationId);
    if (!invitation || invitation.invitedUserId !== userId) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== 'pending') {
      return { status: 'ok' };
    }
    if (accept) {
      await this.groupsRepository.joinGroup(userId, invitation.groupId);
    }
    await this.groupsRepository.respondToInvitation(invitationId, accept ? 'accepted' : 'declined');
    return { status: 'ok' };
  }

  async updateGroup(
    userId: string,
    groupId: string,
    payload: UpdateGroupDto,
  ): Promise<{
    id: string;
    organizationId: string;
    name: string;
    description: string | null;
    groupType: string;
    groupPrivacy: string;
    photoUrl: string | null;
    updatedAt: string;
  }> {
    const access = await this.getGroupAccess(userId, groupId, { requireMember: true });
    if (!access.canManage) {
      throw new ForbiddenException('Only group owners, group admins, and organization admins can edit groups');
    }

    const updateData: { name?: string; description?: string | null; groupType?: string; groupPrivacy?: string; photoUrl?: string | null } = {};
    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) {
        throw new BadRequestException('Group name cannot be empty');
      }
      updateData.name = name;
    }
    if (payload.description !== undefined) {
      updateData.description = payload.description.trim() || null;
    }
    if (payload.groupType !== undefined) {
      updateData.groupType = payload.groupType;
    }
    if (payload.groupPrivacy !== undefined) {
      updateData.groupPrivacy = payload.groupPrivacy;
    }
    if (payload.photoUrl !== undefined) {
      updateData.photoUrl = payload.photoUrl.trim() || null;
    }
    if (!Object.keys(updateData).length) {
      throw new BadRequestException('No editable group fields were provided');
    }

    const updated = await this.groupsRepository.updateGroup(groupId, updateData);
    return {
      id: updated.id,
      organizationId: updated.organizationId,
      name: updated.name,
      description: updated.description,
      groupType: updated.groupType,
      groupPrivacy: updated.groupPrivacy,
      photoUrl: updated.photoUrl,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async updateMemberRole(userId: string, groupId: string, memberUserId: string, role: GroupRole) {
    const access = await this.getGroupAccess(userId, groupId, { requireMember: true });
    if (!access.canManage) {
      throw new ForbiddenException('Only group administrators can update member roles');
    }
    const target = await this.groupsRepository.findGroupMembership(memberUserId, groupId);
    if (!target) {
      throw new NotFoundException('Group member not found');
    }
    if (target.role === GroupRole.owner && !this.canManageOrganization(access.organizationRole)) {
      throw new ForbiddenException('Only organization owners or admins can change a group owner role');
    }
    if (role === GroupRole.owner && !this.canManageOrganization(access.organizationRole)) {
      throw new ForbiddenException('Only organization owners or admins can assign owner role');
    }
    const updated = await this.groupsRepository.updateGroupMembershipRole(groupId, memberUserId, role);
    return { userId: updated.userId, role: updated.role };
  }

  async setFavorite(userId: string, groupId: string, isFavorite: boolean) {
    await this.getGroupAccess(userId, groupId, { requireMember: true });
    const updated = await this.groupsRepository.updateGroupMemberPreferences(groupId, userId, { isFavorite });
    return { isFavorite: updated.isFavorite };
  }

  async recordVisit(userId: string, groupId: string) {
    await this.getGroupAccess(userId, groupId, { requireMember: true });
    const updated = await this.groupsRepository.updateGroupMemberPreferences(groupId, userId, { visit: true });
    return { lastVisitedAt: updated.lastVisitedAt?.toISOString() ?? null };
  }

  async deleteGroup(
    userId: string,
    groupId: string,
    payload?: DeleteGroupDto,
  ): Promise<{ status: 'ok'; groupId: string; postPolicy: 'detach' | 'remove'; affectedPosts: number }> {
    const access = await this.getGroupAccess(userId, groupId, { requireMember: true });
    if (!access.canManage) {
      throw new ForbiddenException('Only group owners, group admins, and organization admins can delete groups');
    }
    const postPolicy = payload?.postPolicy ?? 'detach';
    const listMediaStorageKeys = (this.groupsRepository as Partial<GroupsRepository>).listMediaStorageKeys;
    const storageKeys = listMediaStorageKeys
      ? await listMediaStorageKeys.call(this.groupsRepository, groupId)
      : [];
    if (storageKeys.length && this.mediaService) {
      await this.mediaService.deleteStoredObjects(storageKeys);
    }
    const result = await this.groupsRepository.deleteGroupWithPostPolicy(groupId, postPolicy);
    return { status: 'ok', groupId, postPolicy, affectedPosts: result.affectedPosts };
  }

  async listMembers(userId: string, groupId: string) {
    await this.getGroupAccess(userId, groupId, { requireMember: true });
    const members = await this.groupsRepository.listMembers(groupId);
    return {
      groupId,
      items: members.map((member) => ({
        userId: member.userId,
        displayName: member.user.profile?.displayName ?? 'Unknown',
        avatarUrl: member.user.profile?.avatarUrl ?? null,
        role: member.role,
        joinedAt: member.joinedAt.toISOString(),
      })),
    };
  }

  async getStarterGroupsConfig(userId: string, organizationId: string) {
    const isMember = await this.groupsRepository.findOrganizationMembership(userId, organizationId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this organization');
    }
    const audit = await this.groupsRepository.getOnboardingAudit(organizationId);
    return {
      organizationId,
      onboardingCompleted: Boolean(audit),
      initializedAt: audit?.initializedAt.toISOString() ?? null,
      skipped: audit?.skipped ?? false,
      selectedKeys: audit?.selectedKeys ?? [],
      catalog: starterGroupCatalog.map(({ key, name, description }) => ({ key, name, description })),
    };
  }

  async initializeStarterGroups(userId: string, payload: InitializeStarterGroupsDto) {
    const isMember = await this.groupsRepository.findOrganizationMembership(userId, payload.organizationId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this organization');
    }
    const audit = await this.groupsRepository.getOnboardingAudit(payload.organizationId);
    if (audit) {
      return {
        organizationId: payload.organizationId,
        onboardingCompleted: true,
        alreadyInitialized: true,
        skipped: audit.skipped,
        createdGroupIds: [],
        selectedKeys: audit.selectedKeys,
      };
    }

    const selectedKeySet = new Set((payload.selectedKeys ?? []).map((key) => key.trim()).filter(Boolean));
    selectedKeySet.add(mandatoryStarterGroupKey);
    const selectedItems = starterGroupCatalog.filter((item) => selectedKeySet.has(item.key));
    const createdGroupIds: string[] = [];
    for (const item of selectedItems) {
      const group = await this.groupsRepository.ensureStarterGroup({
        organizationId: payload.organizationId,
        createdBy: userId,
        name: item.name,
        description: item.description,
        groupType: item.groupType,
        groupPrivacy: item.groupPrivacy,
      });
      createdGroupIds.push(group.id);
    }

    const skipped = Boolean(payload.skipped) && selectedItems.length === 1;
    await this.groupsRepository.upsertOnboardingAudit({
      organizationId: payload.organizationId,
      initializedBy: userId,
      skipped,
      selectedKeys: selectedItems.map((item) => item.key),
    });
    return {
      organizationId: payload.organizationId,
      onboardingCompleted: true,
      alreadyInitialized: false,
      skipped,
      createdGroupIds,
      selectedKeys: selectedItems.map((item) => item.key),
    };
  }
}
