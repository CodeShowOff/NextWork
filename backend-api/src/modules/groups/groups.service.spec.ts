import { ForbiddenException } from '@nestjs/common';

import { GroupsRepository } from './groups.repository';
import { GroupsService } from './groups.service';

describe('GroupsService starter onboarding', () => {
  const groupsRepositoryMock: Partial<Record<keyof GroupsRepository, jest.Mock>> = {
    findOrganizationMembership: jest.fn(),
    getOnboardingAudit: jest.fn(),
    ensureStarterGroup: jest.fn(),
    upsertOnboardingAudit: jest.fn(),
  };

  const service = new GroupsService(groupsRepositoryMock as unknown as GroupsRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    groupsRepositoryMock.findOrganizationMembership?.mockResolvedValue(true);
    groupsRepositoryMock.getOnboardingAudit?.mockResolvedValue(null);
    groupsRepositoryMock.ensureStarterGroup?.mockImplementation(async ({ name }) => ({
      id: `group-${name}`,
      name,
    }));
    groupsRepositoryMock.upsertOnboardingAudit?.mockResolvedValue(undefined);
  });

  it('initializes selected starter groups for subset selection', async () => {
    const result = await service.initializeStarterGroups('u1', {
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      selectedKeys: ['general', 'project-updates'],
    });

    expect(result.alreadyInitialized).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.selectedKeys).toEqual(['project-updates', 'general']);
    expect(groupsRepositoryMock.ensureStarterGroup).toHaveBeenCalledTimes(2);
    expect(groupsRepositoryMock.upsertOnboardingAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
        initializedBy: 'u1',
      }),
    );
  });

  it('initializes all starter groups when all keys are selected', async () => {
    const result = await service.initializeStarterGroups('u1', {
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      selectedKeys: [
        'company-announcements',
        'marketing-team',
        'company-social',
        'project-updates',
        'general',
      ],
    });

    expect(result.skipped).toBe(false);
    expect(result.selectedKeys).toHaveLength(5);
    expect(groupsRepositoryMock.ensureStarterGroup).toHaveBeenCalledTimes(5);
  });

  it('supports skip onboarding without creating groups', async () => {
    const result = await service.initializeStarterGroups('u1', {
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      selectedKeys: [],
      skipped: true,
    });

    expect(result.skipped).toBe(true);
    expect(result.createdGroupIds).toEqual([]);
    expect(groupsRepositoryMock.ensureStarterGroup).not.toHaveBeenCalled();
  });

  it('returns alreadyInitialized on retries and does not create duplicates', async () => {
    groupsRepositoryMock.getOnboardingAudit?.mockResolvedValue({
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      initializedBy: 'u1',
      initializedAt: new Date('2026-03-17T00:00:00.000Z'),
      skipped: false,
      selectedKeys: ['general'],
    });

    const result = await service.initializeStarterGroups('u1', {
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      selectedKeys: ['general', 'project-updates'],
    });

    expect(result.alreadyInitialized).toBe(true);
    expect(result.selectedKeys).toEqual(['general']);
    expect(groupsRepositoryMock.ensureStarterGroup).not.toHaveBeenCalled();
    expect(groupsRepositoryMock.upsertOnboardingAudit).not.toHaveBeenCalled();
  });

  it('rejects non-member onboarding initialization', async () => {
    groupsRepositoryMock.findOrganizationMembership?.mockResolvedValue(false);

    await expect(
      service.initializeStarterGroups('u1', {
        organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
        selectedKeys: ['general'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns config with onboardingCompleted=false when no audit exists', async () => {
    const result = await service.getStarterGroupsConfig(
      'u1',
      '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
    );

    expect(result.organizationId).toBe('89ce5ff7-bc2a-4df8-b56b-b8e92f93e928');
    expect(result.onboardingCompleted).toBe(false);
    expect(result.catalog.length).toBeGreaterThan(0);
  });
});
