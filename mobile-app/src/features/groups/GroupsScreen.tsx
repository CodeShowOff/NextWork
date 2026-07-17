import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageSourcePropType,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  createGroup,
  getStarterGroupsConfig,
  Group,
  GroupMember,
  initializeStarterGroups,
  joinGroup,
  listGroupMembers,
  listGroups,
  StarterGroupCatalogItem,
  updateGroup,
  deleteGroup,
} from '../../shared/api/groups.api';
import { GroupDetailPage } from './GroupDetailPage';
import { createInviteLink, getInviteByToken, acceptInvite } from '../../shared/api/invites.api';
import {
  deactivateOrganization,
  deleteOrganization,
  listMyOrganizations,
  onboardOrganization,
  OrganizationMembership,
  switchOrganization,
  updateOrganization,
} from '../../shared/api/organizations.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { featureFlags } from '../../shared/config/runtime';
import { useInviteLinkStore } from '../../shared/session/invite-link.store';

type GroupsRouteParams = {
  focusGroupId?: string;
  organizationId?: string;
};

const mandatoryStarterGroupKey = 'general';

type GroupSortFilterOption =
  | 'recentlyVisited'
  | 'name'
  | 'favorites'
  | 'top'
  | 'latestActivity';

const groupSortFilterOptions: GroupSortFilterOption[] = [
  'recentlyVisited',
  'name',
  'favorites',
  'top',
  'latestActivity',
];

const groupTypeOptions = ['Teams & Projects', 'Discussions', 'Announcements', 'Social & More'];
const groupPrivacyOptions = ['Open', 'Closed', 'Secret'];

const cloneGroupArtwork: Record<string, ImageSourcePropType> = {
  companyAnnouncements: require('../../../assets/images/group_company_announcements.jpg'),
  marketingTeam: require('../../../assets/images/group_marketing_team.jpg'),
  projectUpdates: require('../../../assets/images/group_project_updates.jpg'),
  general: require('../../../assets/images/group_general.jpg'),
  social: require('../../../assets/images/group_company_social.jpg'),
};

export function GroupsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const [organizationName, setOrganizationName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [lastInviteToken, setLastInviteToken] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [membersGroupId, setMembersGroupId] = useState('');
  const [pendingOrganizationId, setPendingOrganizationId] = useState('');
  const [pendingFocusGroupId, setPendingFocusGroupId] = useState('');
  const [selectedStarterKeys, setSelectedStarterKeys] = useState<string[]>([]);
  const [inlineError, setInlineError] = useState('');
  const [postOnboardingInviteOrganizationId, setPostOnboardingInviteOrganizationId] = useState('');
  const [organizationEditName, setOrganizationEditName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupDescription, setEditingGroupDescription] = useState('');
  const [editingGroupType, setEditingGroupType] = useState(groupTypeOptions[0]);
  const [editingGroupPrivacy, setEditingGroupPrivacy] = useState(groupPrivacyOptions[0]);
  const [editingGroupPhotoUrl, setEditingGroupPhotoUrl] = useState('');
  const [createGroupType, setCreateGroupType] = useState(groupTypeOptions[0]);
  const [createGroupPrivacy, setCreateGroupPrivacy] = useState(groupPrivacyOptions[0]);
  const [createGroupPhotoUrl, setCreateGroupPhotoUrl] = useState('');
  const [groupSortFilter, setGroupSortFilter] = useState<GroupSortFilterOption>('recentlyVisited');
  const [favoriteGroupIds, setFavoriteGroupIds] = useState<string[]>([]);
  const [visitedGroupIds, setVisitedGroupIds] = useState<string[]>([]);
  const [lastActivityByGroupId, setLastActivityByGroupId] = useState<Record<string, number>>({});
  const [activeGroupDetailId, setActiveGroupDetailId] = useState('');
  const [activeGroupDetailSnapshot, setActiveGroupDetailSnapshot] = useState<Group | null>(null);

  const routeParams = (route.params ?? {}) as GroupsRouteParams;

  const markGroupVisited = (groupId: string) => {
    setVisitedGroupIds((current) => [groupId, ...current.filter((id) => id !== groupId)]);
  };

  const markGroupActivity = (groupId: string) => {
    setLastActivityByGroupId((current) => ({
      ...current,
      [groupId]: Date.now(),
    }));
  };

  const pendingInviteToken = useInviteLinkStore((state) => state.pendingInviteToken);
  const clearPendingInviteToken = useInviteLinkStore((state) => state.clearPendingInviteToken);

  const meQuery = useQuery({
    queryKey: ['users', 'me'],
    queryFn: getCurrentUser,
  });

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: listMyOrganizations,
  });

  const organizations = organizationsQuery.data?.items ?? [];
  const activeOrganization = useMemo(() => {
    if (!organizations.length) {
      return null;
    }

    const activeId = meQuery.data?.activeOrganizationId;
    if (!activeId) {
      return organizations[0];
    }

    return organizations.find((item) => item.organizationId === activeId) ?? organizations[0];
  }, [meQuery.data?.activeOrganizationId, organizations]);
  const activeOrganizationId = activeOrganization?.organization.id;
  const canManageActiveOrganization =
    activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';

  const groupsQuery = useQuery({
    queryKey: ['groups', activeOrganizationId],
    queryFn: () => listGroups(activeOrganizationId as string),
    enabled: Boolean(activeOrganizationId),
  });

  const starterGroupsConfigQuery = useQuery({
    queryKey: ['groups', 'onboarding', activeOrganizationId],
    queryFn: () => getStarterGroupsConfig(activeOrganizationId as string),
    enabled: Boolean(activeOrganizationId),
  });

  const onboardMutation = useMutation({
    mutationFn: onboardOrganization,
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: (result) => {
      setOrganizationName('');
      setPendingOrganizationId(result.organizationId);
      switchMutation.mutate(result.organizationId);
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.createOrganizationFailed'), (error as Error).message);
    },
  });

  const switchMutation = useMutation({
    mutationFn: switchOrganization,
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: () => {
      setPendingOrganizationId('');
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error) => {
      setPendingOrganizationId('');
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.switchOrganizationFailed'), (error as Error).message);
    },
  });

  const joinGroupMutation = useMutation({
    mutationFn: joinGroup,
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: (_result, groupId) => {
      markGroupVisited(groupId);
      markGroupActivity(groupId);
      queryClient.invalidateQueries({ queryKey: ['groups', activeOrganizationId] });
      if (membersGroupId) {
        queryClient.invalidateQueries({ queryKey: ['groups', 'members', membersGroupId] });
      }
      Alert.alert(t('groups.alerts.joinGroupSuccessTitle'), t('groups.alerts.joinGroupSuccessBody'));
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.joinGroupFailed'), (error as Error).message);
    },
  });

  const groupMembersQuery = useQuery({
    queryKey: ['groups', 'members', membersGroupId],
    queryFn: () => listGroupMembers(membersGroupId),
    enabled: Boolean(membersGroupId),
  });

  const createGroupMutation = useMutation({
    mutationFn: (payload: {
      organizationId: string;
      name: string;
      groupType: string;
      groupPrivacy: string;
      photoUrl?: string;
    }) => createGroup(payload),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: () => {
      setGroupName('');
      setCreateGroupType(groupTypeOptions[0]);
      setCreateGroupPrivacy(groupPrivacyOptions[0]);
      setCreateGroupPhotoUrl('');
      queryClient.invalidateQueries({ queryKey: ['groups', activeOrganizationId] });
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.createGroupFailed'), (error as Error).message);
    },
  });

  const createInviteMutation = useMutation({
    mutationFn: (organizationId: string) => createInviteLink({ organizationId, expiresInHours: 24 * 7 }),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: (invite) => {
      setLastInviteToken(invite.token);
      setLastInviteUrl(invite.inviteUrl);
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.createInviteFailed'), (error as Error).message);
    },
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: (payload: { organizationId: string; name: string }) =>
      updateOrganization(payload.organizationId, { name: payload.name }),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: () => {
      setOrganizationEditName('');
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      Alert.alert(t('groups.alerts.updateOrganizationSuccessTitle'), t('groups.alerts.updateOrganizationSuccessBody'));
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.updateOrganizationFailed'), (error as Error).message);
    },
  });

  const deactivateOrganizationMutation = useMutation({
    mutationFn: (organizationId: string) => deactivateOrganization(organizationId),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: () => {
      setMembersGroupId('');
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      Alert.alert(t('groups.alerts.deactivateOrganizationSuccessTitle'), t('groups.alerts.deactivateOrganizationSuccessBody'));
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.deactivateOrganizationFailed'), (error as Error).message);
    },
  });

  const deleteOrganizationMutation = useMutation({
    mutationFn: (organizationId: string) => deleteOrganization(organizationId),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: () => {
      setMembersGroupId('');
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      Alert.alert(t('groups.alerts.deleteOrganizationSuccessTitle'), t('groups.alerts.deleteOrganizationSuccessBody'));
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.deleteOrganizationFailed'), (error as Error).message);
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: (payload: {
      groupId: string;
      name: string;
      description: string;
      groupType: string;
      groupPrivacy: string;
      photoUrl?: string;
    }) =>
      updateGroup(payload.groupId, {
        name: payload.name,
        description: payload.description,
        groupType: payload.groupType,
        groupPrivacy: payload.groupPrivacy,
        photoUrl: payload.photoUrl,
      }),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: () => {
      setEditingGroupId('');
      setEditingGroupName('');
      setEditingGroupDescription('');
      setEditingGroupType(groupTypeOptions[0]);
      setEditingGroupPrivacy(groupPrivacyOptions[0]);
      setEditingGroupPhotoUrl('');
      queryClient.invalidateQueries({ queryKey: ['groups', activeOrganizationId] });
      Alert.alert(t('groups.alerts.updateGroupSuccessTitle'), t('groups.alerts.updateGroupSuccessBody'));
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.updateGroupFailed'), (error as Error).message);
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (payload: { groupId: string; postPolicy: 'detach' | 'remove' }) =>
      deleteGroup(payload.groupId, { postPolicy: payload.postPolicy }),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: () => {
      setEditingGroupId('');
      setEditingGroupName('');
      setEditingGroupDescription('');
      setEditingGroupType(groupTypeOptions[0]);
      setEditingGroupPrivacy(groupPrivacyOptions[0]);
      setEditingGroupPhotoUrl('');
      setMembersGroupId('');
      queryClient.invalidateQueries({ queryKey: ['groups', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      Alert.alert(t('groups.alerts.deleteGroupSuccessTitle'), t('groups.alerts.deleteGroupSuccessBody'));
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.deleteGroupFailed'), (error as Error).message);
    },
  });

  const shareInvite = async () => {
    if (!lastInviteUrl) {
      return;
    }

    const orgName = activeOrganization?.organization.name ?? t('groups.alerts.defaultOrgName');
    const message = t('groups.alerts.inviteShareMessage', { orgName, url: lastInviteUrl });

    try {
      await Share.share({
        message,
        url: lastInviteUrl,
      });
    } catch (error) {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.shareInviteFailed'), (error as Error).message);
    }
  };

  const initializeStarterGroupsMutation = useMutation({
    mutationFn: (payload: { organizationId: string; selectedKeys: string[]; skipped?: boolean }) =>
      initializeStarterGroups(payload),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: (result) => {
      setSelectedStarterKeys([]);
      if (!result.alreadyInitialized) {
        setPostOnboardingInviteOrganizationId(result.organizationId);
      }
      queryClient.invalidateQueries({ queryKey: ['groups', 'onboarding', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['groups', activeOrganizationId] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      Alert.alert(t('groups.alerts.onboardingCompleteTitle'), t('groups.alerts.onboardingCompleteBody'));
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.initializeStarterGroupsFailed'), (error as Error).message);
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (token: string) => {
      await getInviteByToken(token);
      return acceptInvite(token);
    },
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: (result) => {
      setInviteTokenInput('');
      clearPendingInviteToken();
      setPendingOrganizationId(result.organizationId);
      switchMutation.mutate(result.organizationId);
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      Alert.alert(t('groups.alerts.acceptInviteSuccessTitle'), t('groups.alerts.acceptInviteSuccessBody'));
    },
    onError: (error) => {
      setInlineError((error as Error).message);
      Alert.alert(t('groups.alerts.acceptInviteFailed'), (error as Error).message);
    },
  });

  useEffect(() => {
    if (!pendingInviteToken) {
      return;
    }

    setInviteTokenInput(pendingInviteToken);
  }, [pendingInviteToken]);

  useEffect(() => {
    if (!organizations.length || meQuery.isLoading || switchMutation.isPending) {
      return;
    }

    if (meQuery.data?.activeOrganizationId) {
      return;
    }

    const firstOrganizationId = organizations[0]?.organizationId;
    if (!firstOrganizationId) {
      return;
    }

    setPendingOrganizationId(firstOrganizationId);
    switchMutation.mutate(firstOrganizationId);
  }, [meQuery.data?.activeOrganizationId, meQuery.isLoading, organizations, switchMutation.isPending]);

  useEffect(() => {
    const focusGroupId = routeParams.focusGroupId;
    const targetOrganizationId = routeParams.organizationId;
    if (!focusGroupId) {
      return;
    }

    setPendingFocusGroupId(focusGroupId);
    if (
      targetOrganizationId &&
      targetOrganizationId !== activeOrganizationId &&
      !switchMutation.isPending
    ) {
      setPendingOrganizationId(targetOrganizationId);
      switchMutation.mutate(targetOrganizationId);
    }
  }, [activeOrganizationId, routeParams.focusGroupId, routeParams.organizationId, switchMutation.isPending]);

  useEffect(() => {
    if (!pendingFocusGroupId || !groupsQuery.data?.items?.length) {
      return;
    }

    const found = groupsQuery.data.items.some((group) => group.id === pendingFocusGroupId);
    if (!found) {
      return;
    }

    setMembersGroupId(pendingFocusGroupId);
    setPendingFocusGroupId('');
  }, [groupsQuery.data?.items, pendingFocusGroupId]);

  useEffect(() => {
    if (!starterGroupsConfigQuery.data?.catalog?.length || selectedStarterKeys.length > 0) {
      return;
    }

    const initialKeys =
      starterGroupsConfigQuery.data.selectedKeys.length > 0
        ? starterGroupsConfigQuery.data.selectedKeys
        : starterGroupsConfigQuery.data.catalog.map((item) => item.key);

    setSelectedStarterKeys(initialKeys.filter((key) => key !== mandatoryStarterGroupKey));
  }, [selectedStarterKeys.length, starterGroupsConfigQuery.data]);

  useEffect(() => {
    if (!activeOrganization?.organization.name) {
      return;
    }

    setOrganizationEditName(activeOrganization.organization.name);
  }, [activeOrganization?.organization.name]);

  useEffect(() => {
    setGroupSortFilter('recentlyVisited');
    setFavoriteGroupIds([]);
    setVisitedGroupIds([]);
    setLastActivityByGroupId({});
  }, [activeOrganizationId]);

  const onboardingRequired =
    featureFlags.onboardingV2 &&
    Boolean(activeOrganizationId) &&
    starterGroupsConfigQuery.data?.onboardingCompleted === false;

  const showPostOnboardingInviteStep =
    featureFlags.onboardingV2 &&
    Boolean(activeOrganizationId) && postOnboardingInviteOrganizationId === activeOrganizationId;

  const isPrimaryActionLoading =
    onboardMutation.isPending ||
    acceptInviteMutation.isPending ||
    initializeStarterGroupsMutation.isPending ||
    createInviteMutation.isPending ||
    switchMutation.isPending;

  const isAdminActionLoading =
    updateOrganizationMutation.isPending ||
    deactivateOrganizationMutation.isPending ||
    deleteOrganizationMutation.isPending ||
    updateGroupMutation.isPending ||
    deleteGroupMutation.isPending;

  const sortedAndFilteredGroups = useMemo(() => {
    const groups = groupsQuery.data?.items ?? [];
    const favoriteSet = new Set(favoriteGroupIds);
    const visitedIndex = new Map(visitedGroupIds.map((id, index) => [id, index]));

    const fallbackNewestFirst = (left: Group, right: Group) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return rightTime - leftTime;
    };

    if (groupSortFilter === 'favorites') {
      return groups
        .filter((group) => favoriteSet.has(group.id))
        .sort((left, right) => left.name.localeCompare(right.name));
    }

    if (groupSortFilter === 'name') {
      return [...groups].sort((left, right) => left.name.localeCompare(right.name));
    }

    if (groupSortFilter === 'top') {
      return [...groups].sort((left, right) => {
        if (right.memberCount !== left.memberCount) {
          return right.memberCount - left.memberCount;
        }
        return left.name.localeCompare(right.name);
      });
    }

    if (groupSortFilter === 'latestActivity') {
      return [...groups].sort((left, right) => {
        const rightActivity = lastActivityByGroupId[right.id] ?? 0;
        const leftActivity = lastActivityByGroupId[left.id] ?? 0;
        if (rightActivity !== leftActivity) {
          return rightActivity - leftActivity;
        }
        return fallbackNewestFirst(left, right);
      });
    }

    return [...groups].sort((left, right) => {
      const leftVisited = visitedIndex.get(left.id);
      const rightVisited = visitedIndex.get(right.id);
      if (leftVisited !== undefined && rightVisited !== undefined) {
        return leftVisited - rightVisited;
      }
      if (leftVisited !== undefined) {
        return -1;
      }
      if (rightVisited !== undefined) {
        return 1;
      }
      return fallbackNewestFirst(left, right);
    });
  }, [favoriteGroupIds, groupSortFilter, groupsQuery.data?.items, lastActivityByGroupId, visitedGroupIds]);

  const homeGroupPreview = useMemo(() => sortedAndFilteredGroups.slice(0, 5), [sortedAndFilteredGroups]);

  const activeGroupDetail = useMemo(() => {
    if (!activeGroupDetailId) {
      return null;
    }

    const liveGroup = groupsQuery.data?.items.find((group) => group.id === activeGroupDetailId);
    if (liveGroup) {
      return liveGroup;
    }

    if (activeGroupDetailSnapshot?.id === activeGroupDetailId) {
      return activeGroupDetailSnapshot;
    }

    return null;
  }, [activeGroupDetailId, activeGroupDetailSnapshot, groupsQuery.data?.items]);

  const resolveGroupArtwork = useCallback((group: Group): ImageSourcePropType | null => {
    const normalizedName = group.name.toLowerCase();
    if (normalizedName.includes('announcement')) {
      return cloneGroupArtwork.companyAnnouncements;
    }
    if (normalizedName.includes('marketing')) {
      return cloneGroupArtwork.marketingTeam;
    }
    if (normalizedName.includes('project') || normalizedName.includes('update')) {
      return cloneGroupArtwork.projectUpdates;
    }
    if (normalizedName.includes('general')) {
      return cloneGroupArtwork.general;
    }
    if (normalizedName.includes('social')) {
      return cloneGroupArtwork.social;
    }

    return cloneGroupArtwork.general;
  }, []);

  const openGroupDetail = useCallback(
    (group: Group) => {
      markGroupVisited(group.id);
      markGroupActivity(group.id);
      setActiveGroupDetailId(group.id);
      setActiveGroupDetailSnapshot(group);
    },
    [markGroupActivity],
  );

  const renderGroupAvatar = useCallback(
    (group: Group) => {
      const fallbackArtwork = resolveGroupArtwork(group);
      if (group.photoUrl) {
        return <Image source={{ uri: group.photoUrl }} style={styles.groupPhoto} />;
      }
      if (fallbackArtwork) {
        return <Image source={fallbackArtwork} style={styles.groupPhoto} />;
      }

      return (
        <View style={styles.groupPhotoPlaceholder}>
          <Text style={styles.groupPhotoPlaceholderText}>{group.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      );
    },
    [resolveGroupArtwork],
  );

  const keyExtractorOrganization = useCallback((item: OrganizationMembership) => item.organizationId, []);
  const keyExtractorFilter = useCallback((item: GroupSortFilterOption) => item, []);
  const keyExtractorGroup = useCallback((item: Group) => item.id, []);
  const keyExtractorMember = useCallback((item: GroupMember) => item.userId + item.joinedAt, []);

  const renderOrganizationChip = useCallback(
    ({ item }: { item: OrganizationMembership }) => (
      <Pressable
        style={[
          styles.chip,
          item.organizationId === activeOrganizationId ? styles.chipActive : null,
          item.organizationId === pendingOrganizationId ? styles.chipPending : null,
        ]}
        onPress={() => {
          setPendingOrganizationId(item.organizationId);
          switchMutation.mutate(item.organizationId);
        }}
        disabled={switchMutation.isPending}
      >
        <Text style={styles.chipText}>{item.organization.name}</Text>
      </Pressable>
    ),
    [activeOrganizationId, pendingOrganizationId, switchMutation],
  );

  const renderGroupFilterChip = useCallback(
    ({ item }: { item: GroupSortFilterOption }) => (
      <Pressable
        style={[
          styles.groupFilterChip,
          item === groupSortFilter ? styles.groupFilterChipActive : null,
        ]}
        onPress={() => setGroupSortFilter(item)}
      >
        <Text
          style={[
            styles.groupFilterChipText,
            item === groupSortFilter ? styles.groupFilterChipTextActive : null,
          ]}
        >
          {t(`groups.filters.${item}`)}
        </Text>
      </Pressable>
    ),
    [groupSortFilter, t],
  );

  const renderGroupMember = useCallback(
    ({ item: member }: { item: GroupMember }) => (
      <View style={styles.memberRow}>
        <Text style={styles.memberName}>{member.displayName}</Text>
        <Text style={styles.memberMeta}>
          {t('groups.labels.memberDate', {
            date: new Date(member.joinedAt).toLocaleDateString(),
          })}
        </Text>
      </View>
    ),
    [t],
  );

  if (activeGroupDetail) {
    return (
      <GroupDetailPage
        group={activeGroupDetail}
        fallbackArtwork={resolveGroupArtwork(activeGroupDetail)}
        onBack={() => {
          setActiveGroupDetailId('');
          setActiveGroupDetailSnapshot(null);
        }}
      />
    );
  }

  if (organizationsQuery.isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#0B6E4F" />
      </View>
    );
  }

  if (organizations.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('groups.title.createOrganization')}</Text>
          <Text style={styles.subtitle}>{t('groups.subtitle.createOrganization')}</Text>
          <TextInput
            value={organizationName}
            onChangeText={setOrganizationName}
            placeholder={t('groups.placeholders.organizationName')}
            style={styles.input}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              const name = organizationName.trim();
              if (!name) {
                return;
              }
              onboardMutation.mutate({ name });
            }}
          >
            <Text style={styles.primaryButtonText}>
              {onboardMutation.isPending ? t('groups.buttons.creatingOrganization') : t('groups.buttons.createOrganization')}
            </Text>
          </Pressable>
          {onboardMutation.isPending ? <ActivityIndicator size="small" color="#0B6E4F" style={styles.inlineSpinner} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{t('groups.title.joinWithInvite')}</Text>
          <TextInput
            value={inviteTokenInput}
            onChangeText={setInviteTokenInput}
            placeholder={t('groups.placeholders.inviteToken')}
            style={styles.input}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              const token = inviteTokenInput.trim();
              if (!token) {
                return;
              }
              acceptInviteMutation.mutate(token);
            }}
          >
            <Text style={styles.primaryButtonText}>
              {acceptInviteMutation.isPending ? t('groups.buttons.acceptingInvite') : t('groups.buttons.acceptInvite')}
            </Text>
          </Pressable>
          {acceptInviteMutation.isPending ? (
            <ActivityIndicator size="small" color="#0B6E4F" style={styles.inlineSpinner} />
          ) : null}
        </View>
        {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}
      </SafeAreaView>
    );
  }

  if (activeOrganizationId && starterGroupsConfigQuery.isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#0B6E4F" />
      </View>
    );
  }

  if (onboardingRequired) {
    const catalog = starterGroupsConfigQuery.data?.catalog ?? [];

    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('groups.title.chooseStarterGroups')}</Text>
          <Text style={styles.subtitle}>{t('groups.subtitle.chooseStarterGroups')}</Text>

          {catalog.map((item: StarterGroupCatalogItem) => {
            const isMandatory = item.key === mandatoryStarterGroupKey;
            const checked = isMandatory || selectedStarterKeys.includes(item.key);

            return (
              <Pressable
                key={item.key}
                style={[styles.starterGroupRow, checked ? styles.starterGroupRowChecked : null]}
                disabled={isMandatory}
                onPress={() => {
                  if (isMandatory) {
                    return;
                  }

                  setSelectedStarterKeys((current) =>
                    current.includes(item.key)
                      ? current.filter((key) => key !== item.key)
                      : [...current, item.key],
                  );
                }}
              >
                {isMandatory ? (
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>{t('groups.labels.required')}</Text>
                  </View>
                ) : (
                  <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
                    {checked ? <Text style={styles.checkboxCheck}>{t('groups.labels.checkboxChecked')}</Text> : null}
                  </View>
                )}
                <View style={styles.starterGroupTextColumn}>
                  <Text style={styles.starterGroupTitle}>{item.name}</Text>
                  <Text style={styles.starterGroupDescription}>{item.description}</Text>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.starterActionsRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                if (!activeOrganizationId) {
                  return;
                }

                initializeStarterGroupsMutation.mutate({
                  organizationId: activeOrganizationId,
                  selectedKeys: [mandatoryStarterGroupKey],
                  skipped: true,
                });
              }}
              disabled={initializeStarterGroupsMutation.isPending}
            >
              <Text style={styles.secondaryButtonText}>
                {initializeStarterGroupsMutation.isPending ? t('groups.buttons.working') : t('common.actions.skip')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                if (!activeOrganizationId) {
                  return;
                }

                initializeStarterGroupsMutation.mutate({
                  organizationId: activeOrganizationId,
                  selectedKeys: [...selectedStarterKeys, mandatoryStarterGroupKey],
                });
              }}
              disabled={initializeStarterGroupsMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {initializeStarterGroupsMutation.isPending ? t('groups.buttons.working') : t('groups.buttons.continue')}
              </Text>
            </Pressable>
          </View>
          {initializeStarterGroupsMutation.isPending ? (
            <ActivityIndicator size="small" color="#0B6E4F" style={styles.starterSpinner} />
          ) : null}
          {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (showPostOnboardingInviteStep) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('groups.firstRun.title')}</Text>
          <Text style={styles.subtitle}>{t('groups.firstRun.subtitle')}</Text>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              if (!activeOrganizationId) {
                return;
              }
              createInviteMutation.mutate(activeOrganizationId);
            }}
            disabled={isPrimaryActionLoading}
          >
            <Text style={styles.secondaryButtonText}>
              {createInviteMutation.isPending ? t('groups.buttons.working') : t('groups.buttons.generateInvite')}
            </Text>
          </Pressable>

          {lastInviteUrl ? (
            <Pressable style={styles.secondaryButton} onPress={shareInvite} disabled={isPrimaryActionLoading}>
              <Text style={styles.secondaryButtonText}>{t('groups.buttons.shareInvite')}</Text>
            </Pressable>
          ) : null}

          {lastInviteUrl ? <Text style={styles.linkText}>{t('groups.labels.inviteLink', { url: lastInviteUrl })}</Text> : null}
          {lastInviteToken ? (
            <Text style={styles.tokenText}>{t('groups.labels.inviteToken', { token: lastInviteToken })}</Text>
          ) : null}

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              setPostOnboardingInviteOrganizationId('');
              (navigation as unknown as { navigate: (name: string) => void }).navigate('Feed');
            }}
            disabled={isPrimaryActionLoading}
          >
            <Text style={styles.primaryButtonText}>{t('groups.firstRun.continueToApp')}</Text>
          </Pressable>

          {createInviteMutation.isPending ? (
            <ActivityIndicator size="small" color="#0B6E4F" style={styles.inlineSpinner} />
          ) : null}
          {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.headerCard}>
        <Text style={styles.orgName}>{activeOrganization?.organization.name}</Text>
        <Text style={styles.activeOrgLabel}>{t('groups.title.activeOrganization')}</Text>
        <Text style={styles.subtitle}>
          {t('groups.subtitle.groupsCount', { count: activeOrganization?.organization.groupCount ?? 0 })}
        </Text>
        <Text style={styles.subtitle}>
          {t('groups.subtitle.membersCount', { count: activeOrganization?.organization.memberCount ?? 0 })}
        </Text>
        <Text style={styles.subtitle}>{t('groups.labels.organizationRole', { role: activeOrganization?.role ?? 'member' })}</Text>

        {canManageActiveOrganization ? (
          <View style={styles.adminPanel}>
            <Text style={styles.adminPanelTitle}>{t('groups.title.organizationAdmin')}</Text>
            <TextInput
              value={organizationEditName}
              onChangeText={setOrganizationEditName}
              placeholder={t('groups.placeholders.organizationName')}
              style={styles.input}
            />
            <View style={styles.adminActionsRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  if (!activeOrganizationId) {
                    return;
                  }

                  const nextName = organizationEditName.trim();
                  if (!nextName) {
                    return;
                  }

                  updateOrganizationMutation.mutate({
                    organizationId: activeOrganizationId,
                    name: nextName,
                  });
                }}
                disabled={isAdminActionLoading}
              >
                <Text style={styles.secondaryButtonText}>{t('groups.buttons.saveOrganization')}</Text>
              </Pressable>
              <Pressable
                style={styles.warningButton}
                onPress={() => {
                  if (!activeOrganizationId) {
                    return;
                  }

                  Alert.alert(
                    t('groups.alerts.deactivateOrganizationConfirmTitle'),
                    t('groups.alerts.deactivateOrganizationConfirmBody'),
                    [
                      { text: t('common.actions.cancel'), style: 'cancel' },
                      {
                        text: t('groups.buttons.deactivateOrganization'),
                        style: 'destructive',
                        onPress: () => deactivateOrganizationMutation.mutate(activeOrganizationId),
                      },
                    ],
                  );
                }}
                disabled={isAdminActionLoading}
              >
                <Text style={styles.warningButtonText}>{t('groups.buttons.deactivateOrganization')}</Text>
              </Pressable>
              <Pressable
                style={styles.dangerButton}
                onPress={() => {
                  if (!activeOrganizationId) {
                    return;
                  }

                  Alert.alert(
                    t('groups.alerts.deleteOrganizationConfirmTitle'),
                    t('groups.alerts.deleteOrganizationConfirmBody'),
                    [
                      { text: t('common.actions.cancel'), style: 'cancel' },
                      {
                        text: t('groups.buttons.deleteOrganization'),
                        style: 'destructive',
                        onPress: () => deleteOrganizationMutation.mutate(activeOrganizationId),
                      },
                    ],
                  );
                }}
                disabled={isAdminActionLoading}
              >
                <Text style={styles.dangerButtonText}>{t('groups.buttons.deleteOrganization')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {featureFlags.flashListRendering ? (
          <FlashList<OrganizationMembership>
            horizontal
            data={organizations}
            keyExtractor={keyExtractorOrganization}
            renderItem={renderOrganizationChip}
            contentContainerStyle={styles.chipsRow}
            showsHorizontalScrollIndicator={false}
          />
        ) : (
          <FlatList<OrganizationMembership>
            horizontal
            data={organizations}
            keyExtractor={keyExtractorOrganization}
            renderItem={renderOrganizationChip}
            contentContainerStyle={styles.chipsRow}
            showsHorizontalScrollIndicator={false}
          />
        )}
        {switchMutation.isPending ? (
          <Text style={styles.switchingText}>{t('groups.labels.switchingOrganization')}</Text>
        ) : null}

        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            if (!activeOrganizationId) {
              return;
            }
            createInviteMutation.mutate(activeOrganizationId);
          }}
          disabled={createInviteMutation.isPending}
        >
          <Text style={styles.secondaryButtonText}>
            {createInviteMutation.isPending ? t('groups.buttons.working') : t('groups.buttons.generateInvite')}
          </Text>
        </Pressable>
        {lastInviteUrl ? (
          <Pressable style={styles.secondaryButton} onPress={shareInvite}>
            <Text style={styles.secondaryButtonText}>{t('groups.buttons.shareInvite')}</Text>
          </Pressable>
        ) : null}
        {lastInviteUrl ? <Text style={styles.linkText}>{t('groups.labels.inviteLink', { url: lastInviteUrl })}</Text> : null}
        {lastInviteToken ? (
          <Text style={styles.tokenText}>{t('groups.labels.inviteToken', { token: lastInviteToken })}</Text>
        ) : null}
        {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}
      </View>

      <View style={styles.homeSectionCard}>
        <View style={styles.homeSectionHeaderRow}>
          <Text style={styles.homeSectionTitle}>{t('groups.title.yourGroups')}</Text>
          <View style={styles.homeFilterPill}>
            <Text style={styles.homeFilterPillText}>{t(`groups.filters.${groupSortFilter}`)}</Text>
          </View>
        </View>
        {homeGroupPreview.map((group) => (
          <Pressable
            key={`home-preview-${group.id}`}
            style={styles.homeListRow}
            onPress={() => {
              markGroupVisited(group.id);
              markGroupActivity(group.id);
              setMembersGroupId((current) => (current === group.id ? '' : group.id));
            }}
          >
            {renderGroupAvatar(group)}
            <View style={styles.homeListTextColumn}>
              <Text style={styles.homeListName}>{group.name}</Text>
              <Text style={styles.homeListMeta}>{`${group.groupPrivacy} group • ${group.memberCount} members`}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.composerRow}>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder={t('groups.placeholders.createGroup')}
          style={[styles.input, styles.composerInput]}
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (!activeOrganizationId) {
              return;
            }

            const name = groupName.trim();
            if (!name) {
              return;
            }

            createGroupMutation.mutate({
              organizationId: activeOrganizationId,
              name,
              groupType: createGroupType,
              groupPrivacy: createGroupPrivacy,
              photoUrl: createGroupPhotoUrl.trim() || undefined,
            });
          }}
        >
          <Text style={styles.primaryButtonText}>{t('groups.buttons.create')}</Text>
        </Pressable>
      </View>

      <View style={styles.groupMetadataComposerCard}>
        <Text style={styles.metadataLabel}>{t('groups.labels.groupType')}</Text>
        <View style={styles.metadataOptionsRow}>
          {groupTypeOptions.map((typeOption) => (
            <Pressable
              key={typeOption}
              style={[
                styles.metadataOptionChip,
                createGroupType === typeOption ? styles.metadataOptionChipActive : null,
              ]}
              onPress={() => setCreateGroupType(typeOption)}
            >
              <Text
                style={[
                  styles.metadataOptionText,
                  createGroupType === typeOption ? styles.metadataOptionTextActive : null,
                ]}
              >
                {typeOption}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.metadataLabel}>{t('groups.labels.groupPrivacy')}</Text>
        <View style={styles.metadataOptionsRow}>
          {groupPrivacyOptions.map((privacyOption) => (
            <Pressable
              key={privacyOption}
              style={[
                styles.metadataOptionChip,
                createGroupPrivacy === privacyOption ? styles.metadataOptionChipActive : null,
              ]}
              onPress={() => setCreateGroupPrivacy(privacyOption)}
            >
              <Text
                style={[
                  styles.metadataOptionText,
                  createGroupPrivacy === privacyOption ? styles.metadataOptionTextActive : null,
                ]}
              >
                {privacyOption}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={createGroupPhotoUrl}
          onChangeText={setCreateGroupPhotoUrl}
          placeholder={t('groups.placeholders.groupPhotoUrl')}
          style={styles.input}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.groupListHeaderRow}>
        <Text style={styles.groupListTitle}>{t('groups.title.yourGroups')}</Text>
        {featureFlags.flashListRendering ? (
          <FlashList<GroupSortFilterOption>
            horizontal
            data={groupSortFilterOptions}
            keyExtractor={keyExtractorFilter}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupFilterRow}
            renderItem={renderGroupFilterChip}
          />
        ) : (
          <FlatList<GroupSortFilterOption>
            horizontal
            data={groupSortFilterOptions}
            keyExtractor={keyExtractorFilter}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupFilterRow}
            renderItem={renderGroupFilterChip}
          />
        )}
      </View>

      {groupsQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#0B6E4F" />
        </View>
      ) : featureFlags.flashListRendering ? (
        <FlashList<Group>
          data={sortedAndFilteredGroups}
          keyExtractor={keyExtractorGroup}
          extraData={`${membersGroupId}|${editingGroupId}|${favoriteGroupIds.join('|')}|${groupSortFilter}`}
          renderItem={({ item }) => (
            <View style={styles.groupCard}>
              <View style={styles.groupIdentityRow}>
                {renderGroupAvatar(item)}
                <View style={styles.groupIdentityTextColumn}>
                  <Text style={styles.groupTitle}>{item.name}</Text>
                  <Text style={styles.groupMetaSecondary}>{`${item.groupPrivacy} • ${item.groupType}`}</Text>
                </View>
              </View>
              {item.description ? <Text style={styles.groupDescription}>{item.description}</Text> : null}
              <Text style={styles.groupMeta}>{t('groups.labels.memberCount', { count: item.memberCount })}</Text>
              <View style={styles.groupActionsRow}>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    favoriteGroupIds.includes(item.id) ? styles.favoriteButtonActive : null,
                  ]}
                  onPress={() => {
                    setFavoriteGroupIds((current) =>
                      current.includes(item.id)
                        ? current.filter((groupId) => groupId !== item.id)
                        : [...current, item.id],
                    );
                    markGroupActivity(item.id);
                  }}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      favoriteGroupIds.includes(item.id) ? styles.favoriteButtonTextActive : null,
                    ]}
                  >
                    {favoriteGroupIds.includes(item.id)
                      ? t('groups.buttons.unfavorite')
                      : t('groups.buttons.favorite')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    joinGroupMutation.mutate(item.id);
                  }}
                  disabled={joinGroupMutation.isPending}
                >
                  <Text style={styles.secondaryButtonText}>{t('groups.buttons.join')}</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    markGroupVisited(item.id);
                    markGroupActivity(item.id);
                    setMembersGroupId((current) => (current === item.id ? '' : item.id));
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    {membersGroupId === item.id
                      ? t('groups.buttons.hideMembers')
                      : t('groups.buttons.viewMembers')}
                  </Text>
                </Pressable>
                {canManageActiveOrganization ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      markGroupVisited(item.id);
                      markGroupActivity(item.id);
                      setEditingGroupId((current) => {
                        if (current === item.id) {
                          setEditingGroupName('');
                          setEditingGroupDescription('');
                          setEditingGroupType(groupTypeOptions[0]);
                          setEditingGroupPrivacy(groupPrivacyOptions[0]);
                          setEditingGroupPhotoUrl('');
                          return '';
                        }

                        setEditingGroupName(item.name);
                        setEditingGroupDescription(item.description ?? '');
                        setEditingGroupType(item.groupType);
                        setEditingGroupPrivacy(item.groupPrivacy);
                        setEditingGroupPhotoUrl(item.photoUrl ?? '');
                        return item.id;
                      });
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>{t('groups.buttons.editGroup')}</Text>
                  </Pressable>
                ) : null}
              </View>

              {canManageActiveOrganization && editingGroupId === item.id ? (
                <View style={styles.adminPanel}>
                  <Text style={styles.adminPanelTitle}>{t('groups.title.groupAdmin')}</Text>
                  <TextInput
                    value={editingGroupName}
                    onChangeText={setEditingGroupName}
                    placeholder={t('groups.placeholders.groupName')}
                    style={styles.input}
                  />
                  <TextInput
                    value={editingGroupDescription}
                    onChangeText={setEditingGroupDescription}
                    placeholder={t('groups.placeholders.groupDescription')}
                    style={styles.input}
                  />
                  <Text style={styles.metadataLabel}>{t('groups.labels.groupType')}</Text>
                  <View style={styles.metadataOptionsRow}>
                    {groupTypeOptions.map((typeOption) => (
                      <Pressable
                        key={typeOption}
                        style={[
                          styles.metadataOptionChip,
                          editingGroupType === typeOption ? styles.metadataOptionChipActive : null,
                        ]}
                        onPress={() => setEditingGroupType(typeOption)}
                      >
                        <Text
                          style={[
                            styles.metadataOptionText,
                            editingGroupType === typeOption ? styles.metadataOptionTextActive : null,
                          ]}
                        >
                          {typeOption}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.metadataLabel}>{t('groups.labels.groupPrivacy')}</Text>
                  <View style={styles.metadataOptionsRow}>
                    {groupPrivacyOptions.map((privacyOption) => (
                      <Pressable
                        key={privacyOption}
                        style={[
                          styles.metadataOptionChip,
                          editingGroupPrivacy === privacyOption ? styles.metadataOptionChipActive : null,
                        ]}
                        onPress={() => setEditingGroupPrivacy(privacyOption)}
                      >
                        <Text
                          style={[
                            styles.metadataOptionText,
                            editingGroupPrivacy === privacyOption ? styles.metadataOptionTextActive : null,
                          ]}
                        >
                          {privacyOption}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={editingGroupPhotoUrl}
                    onChangeText={setEditingGroupPhotoUrl}
                    placeholder={t('groups.placeholders.groupPhotoUrl')}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                  <View style={styles.adminActionsRow}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        const nextName = editingGroupName.trim();
                        if (!nextName) {
                          return;
                        }

                        updateGroupMutation.mutate({
                          groupId: item.id,
                          name: nextName,
                          description: editingGroupDescription,
                          groupType: editingGroupType,
                          groupPrivacy: editingGroupPrivacy,
                          photoUrl: editingGroupPhotoUrl.trim() || undefined,
                        });
                      }}
                      disabled={isAdminActionLoading}
                    >
                      <Text style={styles.secondaryButtonText}>{t('common.actions.save')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        setEditingGroupId('');
                        setEditingGroupName('');
                        setEditingGroupDescription('');
                        setEditingGroupType(groupTypeOptions[0]);
                        setEditingGroupPrivacy(groupPrivacyOptions[0]);
                        setEditingGroupPhotoUrl('');
                      }}
                      disabled={isAdminActionLoading}
                    >
                      <Text style={styles.secondaryButtonText}>{t('common.actions.cancel')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.dangerButton}
                      onPress={() => {
                        Alert.alert(
                          t('groups.alerts.deleteGroupConfirmTitle'),
                          t('groups.alerts.deleteGroupConfirmBody'),
                          [
                            { text: t('common.actions.cancel'), style: 'cancel' },
                            {
                              text: t('groups.buttons.deleteGroup'),
                              style: 'destructive',
                              onPress: () =>
                                deleteGroupMutation.mutate({
                                  groupId: item.id,
                                  postPolicy: 'detach',
                                }),
                            },
                          ],
                        );
                      }}
                      disabled={isAdminActionLoading}
                    >
                      <Text style={styles.dangerButtonText}>{t('groups.buttons.deleteGroup')}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {membersGroupId === item.id ? (
                <View style={styles.membersPanel}>
                  {groupMembersQuery.isLoading ? (
                    <ActivityIndicator size="small" color="#0B6E4F" />
                  ) : (
                    featureFlags.flashListRendering ? (
                      <FlashList<GroupMember>
                        data={groupMembersQuery.data?.items ?? []}
                        keyExtractor={keyExtractorMember}
                        renderItem={renderGroupMember}
                        scrollEnabled={false}
                        ListEmptyComponent={<Text style={styles.subtitle}>{t('groups.subtitle.noMembers')}</Text>}
                      />
                    ) : (
                      <FlatList<GroupMember>
                        data={groupMembersQuery.data?.items ?? []}
                        keyExtractor={keyExtractorMember}
                        renderItem={renderGroupMember}
                        scrollEnabled={false}
                        ListEmptyComponent={<Text style={styles.subtitle}>{t('groups.subtitle.noMembers')}</Text>}
                      />
                    )
                  )}
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.subtitle}>
                {groupSortFilter === 'favorites'
                  ? t('groups.subtitle.noFavoriteGroups')
                  : t('groups.subtitle.noGroups')}
              </Text>
            </View>
          }
        />
        ) : (
        <FlatList<Group>
          data={sortedAndFilteredGroups}
          keyExtractor={keyExtractorGroup}
          extraData={`${membersGroupId}|${editingGroupId}|${favoriteGroupIds.join('|')}|${groupSortFilter}`}
          renderItem={({ item }) => (
            <View style={styles.groupCard}>
              <View style={styles.groupIdentityRow}>
                {renderGroupAvatar(item)}
                <View style={styles.groupIdentityTextColumn}>
                  <Text style={styles.groupTitle}>{item.name}</Text>
                  <Text style={styles.groupMetaSecondary}>{`${item.groupPrivacy} • ${item.groupType}`}</Text>
                </View>
              </View>
              {item.description ? <Text style={styles.groupDescription}>{item.description}</Text> : null}
              <Text style={styles.groupMeta}>{t('groups.labels.memberCount', { count: item.memberCount })}</Text>
              <View style={styles.groupActionsRow}>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    favoriteGroupIds.includes(item.id) ? styles.favoriteButtonActive : null,
                  ]}
                  onPress={() => {
                    setFavoriteGroupIds((current) =>
                      current.includes(item.id)
                        ? current.filter((groupId) => groupId !== item.id)
                        : [...current, item.id],
                    );
                    markGroupActivity(item.id);
                  }}
                >
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      favoriteGroupIds.includes(item.id) ? styles.favoriteButtonTextActive : null,
                    ]}
                  >
                    {favoriteGroupIds.includes(item.id)
                      ? t('groups.buttons.unfavorite')
                      : t('groups.buttons.favorite')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    joinGroupMutation.mutate(item.id);
                  }}
                  disabled={joinGroupMutation.isPending}
                >
                  <Text style={styles.secondaryButtonText}>{t('groups.buttons.join')}</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    markGroupVisited(item.id);
                    markGroupActivity(item.id);
                    setMembersGroupId((current) => (current === item.id ? '' : item.id));
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    {membersGroupId === item.id
                      ? t('groups.buttons.hideMembers')
                      : t('groups.buttons.viewMembers')}
                  </Text>
                </Pressable>
                {canManageActiveOrganization ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      markGroupVisited(item.id);
                      markGroupActivity(item.id);
                      setEditingGroupId((current) => {
                        if (current === item.id) {
                          setEditingGroupName('');
                          setEditingGroupDescription('');
                          setEditingGroupType(groupTypeOptions[0]);
                          setEditingGroupPrivacy(groupPrivacyOptions[0]);
                          setEditingGroupPhotoUrl('');
                          return '';
                        }

                        setEditingGroupName(item.name);
                        setEditingGroupDescription(item.description ?? '');
                        setEditingGroupType(item.groupType);
                        setEditingGroupPrivacy(item.groupPrivacy);
                        setEditingGroupPhotoUrl(item.photoUrl ?? '');
                        return item.id;
                      });
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>{t('groups.buttons.editGroup')}</Text>
                  </Pressable>
                ) : null}
              </View>

              {canManageActiveOrganization && editingGroupId === item.id ? (
                <View style={styles.adminPanel}>
                  <Text style={styles.adminPanelTitle}>{t('groups.title.groupAdmin')}</Text>
                  <TextInput
                    value={editingGroupName}
                    onChangeText={setEditingGroupName}
                    placeholder={t('groups.placeholders.groupName')}
                    style={styles.input}
                  />
                  <TextInput
                    value={editingGroupDescription}
                    onChangeText={setEditingGroupDescription}
                    placeholder={t('groups.placeholders.groupDescription')}
                    style={styles.input}
                  />
                  <Text style={styles.metadataLabel}>{t('groups.labels.groupType')}</Text>
                  <View style={styles.metadataOptionsRow}>
                    {groupTypeOptions.map((typeOption) => (
                      <Pressable
                        key={typeOption}
                        style={[
                          styles.metadataOptionChip,
                          editingGroupType === typeOption ? styles.metadataOptionChipActive : null,
                        ]}
                        onPress={() => setEditingGroupType(typeOption)}
                      >
                        <Text
                          style={[
                            styles.metadataOptionText,
                            editingGroupType === typeOption ? styles.metadataOptionTextActive : null,
                          ]}
                        >
                          {typeOption}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.metadataLabel}>{t('groups.labels.groupPrivacy')}</Text>
                  <View style={styles.metadataOptionsRow}>
                    {groupPrivacyOptions.map((privacyOption) => (
                      <Pressable
                        key={privacyOption}
                        style={[
                          styles.metadataOptionChip,
                          editingGroupPrivacy === privacyOption ? styles.metadataOptionChipActive : null,
                        ]}
                        onPress={() => setEditingGroupPrivacy(privacyOption)}
                      >
                        <Text
                          style={[
                            styles.metadataOptionText,
                            editingGroupPrivacy === privacyOption ? styles.metadataOptionTextActive : null,
                          ]}
                        >
                          {privacyOption}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={editingGroupPhotoUrl}
                    onChangeText={setEditingGroupPhotoUrl}
                    placeholder={t('groups.placeholders.groupPhotoUrl')}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                  <View style={styles.adminActionsRow}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        const nextName = editingGroupName.trim();
                        if (!nextName) {
                          return;
                        }

                        updateGroupMutation.mutate({
                          groupId: item.id,
                          name: nextName,
                          description: editingGroupDescription,
                          groupType: editingGroupType,
                          groupPrivacy: editingGroupPrivacy,
                          photoUrl: editingGroupPhotoUrl.trim() || undefined,
                        });
                      }}
                      disabled={isAdminActionLoading}
                    >
                      <Text style={styles.secondaryButtonText}>{t('common.actions.save')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        setEditingGroupId('');
                        setEditingGroupName('');
                        setEditingGroupDescription('');
                        setEditingGroupType(groupTypeOptions[0]);
                        setEditingGroupPrivacy(groupPrivacyOptions[0]);
                        setEditingGroupPhotoUrl('');
                      }}
                      disabled={isAdminActionLoading}
                    >
                      <Text style={styles.secondaryButtonText}>{t('common.actions.cancel')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.dangerButton}
                      onPress={() => {
                        Alert.alert(
                          t('groups.alerts.deleteGroupConfirmTitle'),
                          t('groups.alerts.deleteGroupConfirmBody'),
                          [
                            { text: t('common.actions.cancel'), style: 'cancel' },
                            {
                              text: t('groups.buttons.deleteGroup'),
                              style: 'destructive',
                              onPress: () =>
                                deleteGroupMutation.mutate({
                                  groupId: item.id,
                                  postPolicy: 'detach',
                                }),
                            },
                          ],
                        );
                      }}
                      disabled={isAdminActionLoading}
                    >
                      <Text style={styles.dangerButtonText}>{t('groups.buttons.deleteGroup')}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {membersGroupId === item.id ? (
                <View style={styles.membersPanel}>
                  {groupMembersQuery.isLoading ? (
                    <ActivityIndicator size="small" color="#0B6E4F" />
                  ) : (
                    featureFlags.flashListRendering ? (
                      <FlashList<GroupMember>
                        data={groupMembersQuery.data?.items ?? []}
                        keyExtractor={keyExtractorMember}
                        renderItem={renderGroupMember}
                        scrollEnabled={false}
                        ListEmptyComponent={<Text style={styles.subtitle}>{t('groups.subtitle.noMembers')}</Text>}
                      />
                    ) : (
                      <FlatList<GroupMember>
                        data={groupMembersQuery.data?.items ?? []}
                        keyExtractor={keyExtractorMember}
                        renderItem={renderGroupMember}
                        scrollEnabled={false}
                        ListEmptyComponent={<Text style={styles.subtitle}>{t('groups.subtitle.noMembers')}</Text>}
                      />
                    )
                  )}
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.subtitle}>
                {groupSortFilter === 'favorites'
                  ? t('groups.subtitle.noFavoriteGroups')
                  : t('groups.subtitle.noGroups')}
              </Text>
            </View>
          }
        />
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  homeSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  homeSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  homeSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
  },
  homeFilterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  homeFilterPillText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 12,
  },
  homeListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  homeListTextColumn: {
    flex: 1,
  },
  homeListName: {
    color: '#111827',
    fontWeight: '700',
    fontSize: 16,
  },
  homeListMeta: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  orgName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeOrgLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#0B6E4F',
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 4,
    color: '#475569',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginTop: 10,
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: '#0B6E4F',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  secondaryButtonText: {
    color: '#0B6E4F',
    fontWeight: '700',
  },
  warningButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#B45309',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFBEB',
  },
  warningButtonText: {
    color: '#B45309',
    fontWeight: '700',
  },
  dangerButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2',
  },
  dangerButtonText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  tokenText: {
    marginTop: 8,
    color: '#1E293B',
  },
  linkText: {
    marginTop: 8,
    color: '#1E293B',
  },
  inlineError: {
    marginTop: 8,
    color: '#B91C1C',
    fontSize: 12,
  },
  inlineSpinner: {
    marginTop: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipActive: {
    borderColor: '#0B6E4F',
    backgroundColor: '#DCFCE7',
  },
  chipPending: {
    opacity: 0.65,
  },
  chipText: {
    fontWeight: '600',
    color: '#0F172A',
  },
  switchingText: {
    marginTop: 8,
    color: '#475569',
    fontSize: 12,
  },
  chipsRow: {
    marginTop: 10,
    paddingRight: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  composerInput: {
    flex: 1,
    marginTop: 0,
  },
  groupMetadataComposerCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 10,
    marginBottom: 8,
  },
  metadataLabel: {
    marginTop: 10,
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  metadataOptionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metadataOptionChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  metadataOptionChipActive: {
    borderColor: '#0B6E4F',
    backgroundColor: '#DCFCE7',
  },
  metadataOptionText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  metadataOptionTextActive: {
    color: '#166534',
  },
  groupListHeaderRow: {
    marginBottom: 8,
  },
  groupListTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupFilterRow: {
    marginTop: 8,
    paddingRight: 8,
  },
  groupFilterChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  groupFilterChipActive: {
    borderColor: '#0B6E4F',
    backgroundColor: '#DCFCE7',
  },
  groupFilterChipText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  groupFilterChipTextActive: {
    color: '#166534',
  },
  adminPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
  },
  adminPanelTitle: {
    color: '#0F172A',
    fontWeight: '700',
  },
  adminActionsRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupIdentityTextColumn: {
    flex: 1,
  },
  groupPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E2E8F0',
  },
  groupPhotoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupPhotoPlaceholderText: {
    color: '#1D4ED8',
    fontSize: 16,
    fontWeight: '800',
  },
  groupMetaSecondary: {
    marginTop: 4,
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  groupDescription: {
    marginTop: 6,
    color: '#334155',
  },
  groupMeta: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 12,
  },
  groupActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  favoriteButtonActive: {
    borderColor: '#D97706',
    backgroundColor: '#FFF7ED',
  },
  favoriteButtonTextActive: {
    color: '#B45309',
  },
  membersPanel: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#F8FAFC',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  memberName: {
    color: '#0F172A',
    fontWeight: '600',
  },
  memberMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  starterGroupRow: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  starterGroupRowChecked: {
    borderColor: '#0B6E4F',
    backgroundColor: '#F0FDF4',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#0B6E4F',
    borderColor: '#0B6E4F',
  },
  checkboxCheck: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  requiredBadge: {
    borderWidth: 1,
    borderColor: '#0B6E4F',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 1,
  },
  requiredBadgeText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '700',
  },
  starterGroupTextColumn: {
    flex: 1,
  },
  starterGroupTitle: {
    color: '#0F172A',
    fontWeight: '700',
  },
  starterGroupDescription: {
    marginTop: 4,
    color: '#475569',
    fontSize: 12,
  },
  starterActionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  starterSpinner: {
    marginTop: 10,
  },
});
