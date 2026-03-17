import { ForbiddenException } from '@nestjs/common';

import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService lifecycle', () => {
  const organizationsRepositoryMock: Partial<Record<keyof OrganizationsRepository, jest.Mock>> = {
    findMembership: jest.fn(),
    updateOrganization: jest.fn(),
    deactivateOrganization: jest.fn(),
    findById: jest.fn(),
    deleteOrganizationCascadeSafe: jest.fn(),
  };

  const service = new OrganizationsService(
    organizationsRepositoryMock as unknown as OrganizationsRepository,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    organizationsRepositoryMock.findMembership?.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'u1',
      role: 'owner',
    });
    organizationsRepositoryMock.updateOrganization?.mockResolvedValue({
      id: 'org-1',
      name: 'Updated Org',
      slug: 'updated-org',
      updatedAt: new Date('2026-03-17T00:00:00.000Z'),
    });
    organizationsRepositoryMock.deactivateOrganization?.mockResolvedValue({
      affectedMembers: 4,
      affectedGroups: 2,
    });
    organizationsRepositoryMock.findById?.mockResolvedValue({
      id: 'org-1',
      name: 'Updated Org',
      slug: 'updated-org',
    });
    organizationsRepositoryMock.deleteOrganizationCascadeSafe?.mockResolvedValue({
      deletedPostCount: 7,
    });
  });

  it('updates organization when caller has admin permissions', async () => {
    const result = await service.updateOrganization('u1', 'org-1', {
      name: 'Updated Org',
    });

    expect(result.name).toBe('Updated Org');
    expect(organizationsRepositoryMock.updateOrganization).toHaveBeenCalledWith('org-1', {
      name: 'Updated Org',
    });
  });

  it('blocks organization updates for regular members', async () => {
    organizationsRepositoryMock.findMembership?.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'u1',
      role: 'member',
    });

    await expect(
      service.updateOrganization('u1', 'org-1', {
        name: 'Updated Org',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('deactivates organization with safe cleanup and summary result', async () => {
    const result = await service.deactivateOrganization('u1', 'org-1');

    expect(result.deactivated).toBe(true);
    expect(result.affectedMembers).toBe(4);
    expect(result.affectedGroups).toBe(2);
  });

  it('deletes organization with cascade-safe post cleanup summary', async () => {
    const result = await service.deleteOrganization('u1', 'org-1');

    expect(result.deleted).toBe(true);
    expect(result.deletedPostCount).toBe(7);
  });
});
