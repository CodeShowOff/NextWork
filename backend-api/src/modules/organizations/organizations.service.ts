import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsRepository } from './organizations.repository';
import { MediaService } from '../media/media.service';

export interface OrganizationMembershipView {
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

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly mediaService?: MediaService,
  ) {}

  private canManageOrganization(role: string): boolean {
    return role === 'owner' || role === 'admin';
  }

  async onboardUser(userId: string, payload: CreateOrganizationDto): Promise<{ organizationId: string }> {
    const slug = await this.generateUniqueSlug(payload.name);

    const organization = await this.organizationsRepository.createOrganizationWithOwner({
      name: payload.name.trim(),
      slug,
      ownerUserId: userId,
    });

    await this.organizationsRepository.setActiveOrganization(userId, organization.id);

    return {
      organizationId: organization.id,
    };
  }

  async getMyOrganizations(userId: string): Promise<{ items: OrganizationMembershipView[] }> {
    const rows = await this.organizationsRepository.listByUserId(userId);

    return {
      items: rows.map((row) => ({
        organizationId: row.organizationId,
        role: row.role,
        joinedAt: row.joinedAt.toISOString(),
        organization: {
          id: row.organization.id,
          name: row.organization.name,
          slug: row.organization.slug,
          createdAt: row.organization.createdAt.toISOString(),
          memberCount: row.organization._count.members,
          groupCount: row.organization._count.groups,
        },
      })),
    };
  }

  async switchActiveOrganization(userId: string, organizationId: string): Promise<{ status: 'ok' }> {
    const membership = await this.organizationsRepository.findMembership(userId, organizationId);
    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    await this.organizationsRepository.setActiveOrganization(userId, organizationId);
    return { status: 'ok' };
  }

  async updateOrganization(
    userId: string,
    organizationId: string,
    payload: UpdateOrganizationDto,
  ): Promise<{
    organizationId: string;
    name: string;
    slug: string;
    updatedAt: string;
  }> {
    const membership = await this.organizationsRepository.findMembership(userId, organizationId);
    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    if (!this.canManageOrganization(membership.role)) {
      throw new ForbiddenException('Only owners and admins can edit organizations');
    }

    const updateData: { name?: string } = {};
    if (payload.name !== undefined) {
      const trimmedName = payload.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Organization name cannot be empty');
      }
      updateData.name = trimmedName;
    }

    if (!Object.keys(updateData).length) {
      throw new BadRequestException('No editable organization fields were provided');
    }

    const updated = await this.organizationsRepository.updateOrganization(organizationId, updateData);

    return {
      organizationId: updated.id,
      name: updated.name,
      slug: updated.slug,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deactivateOrganization(
    userId: string,
    organizationId: string,
  ): Promise<{
    status: 'ok';
    organizationId: string;
    deactivated: true;
    affectedMembers: number;
    affectedGroups: number;
  }> {
    const membership = await this.organizationsRepository.findMembership(userId, organizationId);
    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    if (!this.canManageOrganization(membership.role)) {
      throw new ForbiddenException('Only owners and admins can deactivate organizations');
    }

    const result = await this.organizationsRepository.deactivateOrganization(organizationId);
    return {
      status: 'ok',
      organizationId,
      deactivated: true,
      affectedMembers: result.affectedMembers,
      affectedGroups: result.affectedGroups,
    };
  }

  async deleteOrganization(
    userId: string,
    organizationId: string,
  ): Promise<{
    status: 'ok';
    organizationId: string;
    deleted: true;
    deletedPostCount: number;
  }> {
    const membership = await this.organizationsRepository.findMembership(userId, organizationId);
    if (!membership) {
      throw new NotFoundException('Organization membership not found');
    }

    if (!this.canManageOrganization(membership.role)) {
      throw new ForbiddenException('Only owners and admins can delete organizations');
    }

    const organization = await this.organizationsRepository.findById(organizationId);
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const storageKeys = await this.organizationsRepository.listMediaStorageKeysForOrganization(organizationId);
    if (storageKeys.length && this.mediaService) {
      await this.mediaService.deleteStoredObjects(storageKeys);
    }
    const result = await this.organizationsRepository.deleteOrganizationCascadeSafe(organizationId);
    return {
      status: 'ok',
      organizationId,
      deleted: true,
      deletedPostCount: result.deletedPostCount,
    };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = this.toSlug(name);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const suffix = Math.random().toString(36).slice(2, 6);
      const slug = `${base}-${suffix}`;

      const existing = await this.organizationsRepository.findBySlug(slug);
      if (!existing) {
        return slug;
      }
    }

    throw new ConflictException('Could not generate a unique organization slug');
  }

  private toSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'organization';
  }
}
