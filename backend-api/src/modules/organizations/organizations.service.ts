import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsRepository } from './organizations.repository';

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
  constructor(private readonly organizationsRepository: OrganizationsRepository) {}

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
