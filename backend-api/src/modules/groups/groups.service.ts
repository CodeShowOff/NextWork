import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { CreateGroupDto } from './dto/create-group.dto';
import { InitializeStarterGroupsDto } from './dto/initialize-starter-groups.dto';
import { GroupsRepository } from './groups.repository';

export interface GroupView {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
}

const starterGroupCatalog = [
  {
    key: 'company-announcements',
    name: 'Company Announcements',
    description: 'Important updates for all members.',
  },
  {
    key: 'marketing-team',
    name: 'Marketing Team',
    description: 'Campaign planning and brand work.',
  },
  {
    key: 'company-social',
    name: 'Company Social',
    description: 'Casual social updates and celebrations.',
  },
  {
    key: 'project-updates',
    name: 'Project Updates',
    description: 'Status tracking for cross-team projects.',
  },
  {
    key: 'general',
    name: 'General',
    description: 'Open discussion space for everyone.',
  },
] as const;

@Injectable()
export class GroupsService {
  constructor(private readonly groupsRepository: GroupsRepository) {}

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
    });

    return {
      id: group.id,
      name: group.name,
      description: group.description,
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

    const selectedCatalogItems = starterGroupCatalog.filter((item) => selectedKeys.includes(item.key));
    const createdGroupIds: string[] = [];

    for (const item of selectedCatalogItems) {
      const group = await this.groupsRepository.ensureStarterGroup({
        organizationId: payload.organizationId,
        createdBy: userId,
        name: item.name,
        description: item.description,
      });
      createdGroupIds.push(group.id);
    }

    const skipped = Boolean(payload.skipped) || selectedCatalogItems.length === 0;

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
