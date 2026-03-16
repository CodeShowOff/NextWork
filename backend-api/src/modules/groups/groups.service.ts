import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsRepository } from './groups.repository';

export interface GroupView {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
}

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
}
