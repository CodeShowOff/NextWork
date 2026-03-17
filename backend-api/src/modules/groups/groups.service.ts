import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { CreateGroupDto } from './dto/create-group.dto';
import { DeleteGroupDto } from './dto/delete-group.dto';
import { InitializeStarterGroupsDto } from './dto/initialize-starter-groups.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { DEFAULT_GROUP_PRIVACY, DEFAULT_GROUP_TYPE } from './groups.constants';
import { GroupsRepository } from './groups.repository';

export interface GroupView {
  id: string;
  name: string;
  description: string | null;
  groupType: string;
  groupPrivacy: string;
  photoUrl: string | null;
  createdAt: string;
  memberCount: number;
}

const starterGroupCatalog = [
  {
    key: 'company-announcements',
    name: 'Company Announcements',
    description: 'Important updates for all members.',
    groupType: 'Announcements',
    groupPrivacy: 'Open',
    photoUrl: 'https://placehold.co/96x96?text=CA',
  },
  {
    key: 'marketing-team',
    name: 'Marketing Team',
    description: 'Campaign planning and brand work.',
    groupType: 'Discussions',
    groupPrivacy: 'Open',
    photoUrl: 'https://placehold.co/96x96?text=MT',
  },
  {
    key: 'company-social',
    name: 'Company Social',
    description: 'Casual social updates and celebrations.',
    groupType: 'Social & More',
    groupPrivacy: 'Open',
    photoUrl: 'https://placehold.co/96x96?text=CS',
  },
  {
    key: 'project-updates',
    name: 'Project Updates',
    description: 'Status tracking for cross-team projects.',
    groupType: 'Announcements',
    groupPrivacy: 'Open',
    photoUrl: 'https://placehold.co/96x96?text=PU',
  },
  {
    key: 'general',
    name: 'General',
    description: 'Open discussion space for everyone.',
    groupType: 'Teams & Projects',
    groupPrivacy: 'Open',
    photoUrl: 'https://placehold.co/96x96?text=G',
  },
] as const;

const mandatoryStarterGroupKey = 'general';

@Injectable()
export class GroupsService {
  constructor(private readonly groupsRepository: GroupsRepository) {}

  private canManageOrganization(role: string): boolean {
    return role === 'owner' || role === 'admin';
  }

  async listGroups(userId: string, organizationId: string): Promise<{ items: GroupView[] }> {
    const isMember = await this.groupsRepository.findOrganizationMembership(userId, organizationId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const groups = await this.groupsRepository.listGroups(organizationId);
    return {
      items: groups.map((group) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        groupType: group.groupType,
        groupPrivacy: group.groupPrivacy,
        photoUrl: group.photoUrl,
        createdAt: group.createdAt.toISOString(),
        memberCount: group._count.members,
      })),
    };
  }

  async createGroup(userId: string, payload: CreateGroupDto): Promise<GroupView> {
    const isMember = await this.groupsRepository.findOrganizationMembership(userId, payload.organizationId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const group = await this.groupsRepository.createGroup({
      organizationId: payload.organizationId,
      createdBy: userId,
      name: payload.name.trim(),
      description: payload.description?.trim(),
      groupType: payload.groupType ?? DEFAULT_GROUP_TYPE,
      groupPrivacy: payload.groupPrivacy ?? DEFAULT_GROUP_PRIVACY,
      photoUrl: payload.photoUrl?.trim() || undefined,
    });

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      groupType: group.groupType,
      groupPrivacy: group.groupPrivacy,
      photoUrl: group.photoUrl,
      createdAt: group.createdAt.toISOString(),
      memberCount: group._count.members,
    };
  }

  async joinGroup(userId: string, groupId: string): Promise<{ status: 'ok' }> {
    const group = await this.groupsRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const isMember = await this.groupsRepository.findOrganizationMembership(userId, group.organizationId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this organization');
    }

    await this.groupsRepository.joinGroup(userId, groupId);
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
    const group = await this.groupsRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const membership = await this.groupsRepository.findOrganizationMembershipWithRole(
      userId,
      group.organizationId,
    );
    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }
    if (!this.canManageOrganization(membership.role)) {
      throw new ForbiddenException('Only owners and admins can edit groups');
    }

    const updateData: {
      name?: string;
      description?: string | null;
      groupType?: string;
      groupPrivacy?: string;
      photoUrl?: string | null;
    } = {};
    if (payload.name !== undefined) {
      const trimmedName = payload.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Group name cannot be empty');
      }
      updateData.name = trimmedName;
    }

    if (payload.description !== undefined) {
      const trimmedDescription = payload.description.trim();
      updateData.description = trimmedDescription.length > 0 ? trimmedDescription : null;
    }

    if (payload.groupType !== undefined) {
      updateData.groupType = payload.groupType;
    }

    if (payload.groupPrivacy !== undefined) {
      updateData.groupPrivacy = payload.groupPrivacy;
    }

    if (payload.photoUrl !== undefined) {
      const trimmedPhoto = payload.photoUrl.trim();
      updateData.photoUrl = trimmedPhoto.length > 0 ? trimmedPhoto : null;
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

  async deleteGroup(
    userId: string,
    groupId: string,
    payload?: DeleteGroupDto,
  ): Promise<{
    status: 'ok';
    groupId: string;
    postPolicy: 'detach' | 'remove';
    affectedPosts: number;
  }> {
    const group = await this.groupsRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const membership = await this.groupsRepository.findOrganizationMembershipWithRole(
      userId,
      group.organizationId,
    );
    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }
    if (!this.canManageOrganization(membership.role)) {
      throw new ForbiddenException('Only owners and admins can delete groups');
    }

    const postPolicy = payload?.postPolicy ?? 'detach';
    const result = await this.groupsRepository.deleteGroupWithPostPolicy(groupId, postPolicy);
    return {
      status: 'ok',
      groupId,
      postPolicy,
      affectedPosts: result.affectedPosts,
    };
  }

  async listMembers(userId: string, groupId: string): Promise<{
    groupId: string;
    items: Array<{
      userId: string;
      displayName: string;
      avatarUrl: string | null;
      joinedAt: string;
    }>;
  }> {
    const group = await this.groupsRepository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const isMember = await this.groupsRepository.findOrganizationMembership(userId, group.organizationId);
    if (!isMember) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const members = await this.groupsRepository.listMembers(groupId);
    return {
      groupId,
      items: members.map((member) => ({
        userId: member.userId,
        displayName: member.user.profile?.displayName ?? 'Unknown',
        avatarUrl: member.user.profile?.avatarUrl ?? null,
        joinedAt: member.joinedAt.toISOString(),
      })),
    };
  }

  async getStarterGroupsConfig(userId: string, organizationId: string): Promise<{
    organizationId: string;
    onboardingCompleted: boolean;
    initializedAt: string | null;
    skipped: boolean;
    selectedKeys: string[];
    catalog: Array<{ key: string; name: string; description: string }>;
  }> {
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
      catalog: starterGroupCatalog.map((item) => ({
        key: item.key,
        name: item.name,
        description: item.description,
      })),
    };
  }

  async initializeStarterGroups(userId: string, payload: InitializeStarterGroupsDto): Promise<{
    organizationId: string;
    onboardingCompleted: boolean;
    alreadyInitialized: boolean;
    skipped: boolean;
    createdGroupIds: string[];
    selectedKeys: string[];
  }> {
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

    const selectedKeys = (payload.selectedKeys ?? [])
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    const selectedKeySet = new Set(selectedKeys);
    selectedKeySet.add(mandatoryStarterGroupKey);

    const selectedCatalogItems = starterGroupCatalog.filter((item) => selectedKeySet.has(item.key));
    const createdGroupIds: string[] = [];

    for (const item of selectedCatalogItems) {
      const group = await this.groupsRepository.ensureStarterGroup({
        organizationId: payload.organizationId,
        createdBy: userId,
        name: item.name,
        description: item.description,
        groupType: item.groupType,
        groupPrivacy: item.groupPrivacy,
        photoUrl: item.photoUrl,
      });
      createdGroupIds.push(group.id);
    }

    const skipped = Boolean(payload.skipped) && selectedCatalogItems.length === 1;

    await this.groupsRepository.upsertOnboardingAudit({
      organizationId: payload.organizationId,
      initializedBy: userId,
      skipped,
      selectedKeys: selectedCatalogItems.map((item) => item.key),
    });

    return {
      organizationId: payload.organizationId,
      onboardingCompleted: true,
      alreadyInitialized: false,
      skipped,
      createdGroupIds,
      selectedKeys: selectedCatalogItems.map((item) => item.key),
    };
  }
}
