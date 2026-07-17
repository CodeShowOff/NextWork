import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { GroupsRepository } from './groups.repository';
import { GroupsService } from './groups.service';

describe('GroupsService starter onboarding', () => {
  const groupsRepositoryMock: Partial<Record<keyof GroupsRepository, jest.Mock>> = {
    findOrganizationMembership: jest.fn(),
    findOrganizationMembershipWithRole: jest.fn(),
    getOnboardingAudit: jest.fn(),
    ensureStarterGroup: jest.fn(),
    upsertOnboardingAudit: jest.fn(),
    findGroupById: jest.fn(),
    findGroupMembership: jest.fn(),
    joinGroup: jest.fn(),
    createMembershipRequest: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroupWithPostPolicy: jest.fn(),
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
    groupsRepositoryMock.findGroupById?.mockResolvedValue({
      id: 'g1',
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      name: 'General',
      description: null,
      groupType: 'Discussions',
      groupPrivacy: 'Open',
      photoUrl: null,
      createdBy: 'u1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    groupsRepositoryMock.findGroupMembership?.mockResolvedValue(null);
    groupsRepositoryMock.joinGroup?.mockResolvedValue(undefined);
    groupsRepositoryMock.createMembershipRequest?.mockResolvedValue({ id: 'request-1', status: 'pending' });
    groupsRepositoryMock.findOrganizationMembershipWithRole?.mockResolvedValue({ role: 'owner' });
    groupsRepositoryMock.updateGroup?.mockResolvedValue({
      id: 'g1',
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      name: 'Renamed',
      description: 'Updated',
      groupType: 'Discussions',
      groupPrivacy: 'Closed',
      photoUrl: 'https://example.com/group.jpg',
      updatedAt: new Date('2026-03-17T00:00:00.000Z'),
    });
    groupsRepositoryMock.deleteGroupWithPostPolicy?.mockResolvedValue({ affectedPosts: 3 });
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

  it('supports skip onboarding while still creating General', async () => {
    const result = await service.initializeStarterGroups('u1', {
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      selectedKeys: [],
      skipped: true,
    });

    expect(result.skipped).toBe(true);
    expect(result.selectedKeys).toEqual(['general']);
    expect(result.createdGroupIds).toHaveLength(1);
    expect(groupsRepositoryMock.ensureStarterGroup).toHaveBeenCalledTimes(1);
  });

  it('always includes General when selection omits it', async () => {
    const result = await service.initializeStarterGroups('u1', {
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      selectedKeys: ['project-updates'],
    });

    expect(result.skipped).toBe(false);
    expect(result.selectedKeys).toEqual(['project-updates', 'general']);
    expect(groupsRepositoryMock.ensureStarterGroup).toHaveBeenCalledTimes(2);
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

  it('allows owner/admin to update group metadata', async () => {
    const result = await service.updateGroup('u1', 'g1', {
      name: 'Renamed',
      description: 'Updated',
      groupType: 'Discussions',
      groupPrivacy: 'Closed',
      photoUrl: 'https://example.com/group.jpg',
    });

    expect(result.name).toBe('Renamed');
    expect(result.groupType).toBe('Discussions');
    expect(result.groupPrivacy).toBe('Closed');
    expect(result.photoUrl).toBe('https://example.com/group.jpg');
    expect(groupsRepositoryMock.updateGroup).toHaveBeenCalledWith('g1', {
      name: 'Renamed',
      description: 'Updated',
      groupType: 'Discussions',
      groupPrivacy: 'Closed',
      photoUrl: 'https://example.com/group.jpg',
    });
  });

  it('rejects group update for non-admin members', async () => {
    groupsRepositoryMock.findOrganizationMembershipWithRole?.mockResolvedValue({ role: 'member' });

    await expect(
      service.updateGroup('u1', 'g1', {
        name: 'Renamed',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('joins open groups immediately', async () => {
    const result = await service.joinGroup('u1', 'g1');

    expect(result).toEqual({ status: 'joined' });
    expect(groupsRepositoryMock.joinGroup).toHaveBeenCalledWith('u1', 'g1');
  });

  it('creates a membership request for closed groups', async () => {
    groupsRepositoryMock.findGroupById?.mockResolvedValue({
      id: 'g1', organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928', name: 'Closed', description: null,
      groupType: 'Discussions', groupPrivacy: 'Closed', photoUrl: null, createdBy: 'u1', createdAt: new Date(), updatedAt: new Date(),
    });

    await expect(service.joinGroup('u1', 'g1')).resolves.toEqual({ status: 'requested' });
    expect(groupsRepositoryMock.createMembershipRequest).toHaveBeenCalledWith({ groupId: 'g1', requesterId: 'u1' });
    expect(groupsRepositoryMock.joinGroup).not.toHaveBeenCalled();
  });

  it('hides secret groups from non-members', async () => {
    groupsRepositoryMock.findGroupById?.mockResolvedValue({
      id: 'g1', organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928', name: 'Secret', description: null,
      groupType: 'Discussions', groupPrivacy: 'Secret', photoUrl: null, createdBy: 'u1', createdAt: new Date(), updatedAt: new Date(),
    });
    groupsRepositoryMock.findOrganizationMembershipWithRole?.mockResolvedValue({ role: 'member' });

    await expect(service.getGroupAccess('u1', 'g1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes group with detach post policy by default', async () => {
    const result = await service.deleteGroup('u1', 'g1');

    expect(result.postPolicy).toBe('detach');
    expect(groupsRepositoryMock.deleteGroupWithPostPolicy).toHaveBeenCalledWith('g1', 'detach');
  });

  it('supports remove post policy when deleting group', async () => {
    const result = await service.deleteGroup('u1', 'g1', { postPolicy: 'remove' });

    expect(result.postPolicy).toBe('remove');
    expect(groupsRepositoryMock.deleteGroupWithPostPolicy).toHaveBeenCalledWith('g1', 'remove');
  });
});
