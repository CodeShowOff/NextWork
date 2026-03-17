import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
} from '../../shared/api/groups.api';
import { createInviteLink, getInviteByToken, acceptInvite } from '../../shared/api/invites.api';
import {
  listMyOrganizations,
  onboardOrganization,
  OrganizationMembership,
  switchOrganization,
} from '../../shared/api/organizations.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { featureFlags } from '../../shared/config/runtime';
import { useInviteLinkStore } from '../../shared/session/invite-link.store';

type GroupsRouteParams = {
  focusGroupId?: string;
  organizationId?: string;
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

  const routeParams = (route.params ?? {}) as GroupsRouteParams;

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
    onSuccess: () => {
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
    mutationFn: (payload: { organizationId: string; name: string }) => createGroup(payload),
    onMutate: () => {
      setInlineError('');
    },
    onSuccess: () => {
      setGroupName('');
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

    setSelectedStarterKeys(
      starterGroupsConfigQuery.data.selectedKeys.length > 0
        ? starterGroupsConfigQuery.data.selectedKeys
        : starterGroupsConfigQuery.data.catalog.map((item) => item.key),
    );
  }, [selectedStarterKeys.length, starterGroupsConfigQuery.data]);

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

  if (organizationsQuery.isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#0B6E4F" />
      </View>
    );
  }

  if (organizations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
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
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('groups.title.chooseStarterGroups')}</Text>
          <Text style={styles.subtitle}>{t('groups.subtitle.chooseStarterGroups')}</Text>

          {catalog.map((item: StarterGroupCatalogItem) => {
            const checked = selectedStarterKeys.includes(item.key);

            return (
              <Pressable
                key={item.key}
                style={[styles.starterGroupRow, checked ? styles.starterGroupRowChecked : null]}
                onPress={() => {
                  setSelectedStarterKeys((current) =>
                    current.includes(item.key)
                      ? current.filter((key) => key !== item.key)
                      : [...current, item.key],
                  );
                }}
              >
                <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
                  {checked ? <Text style={styles.checkboxCheck}>{t('groups.labels.checkboxChecked')}</Text> : null}
                </View>
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
                  selectedKeys: [],
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
                  selectedKeys: selectedStarterKeys,
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
      <SafeAreaView style={styles.container}>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.orgName}>{activeOrganization?.organization.name}</Text>
        <Text style={styles.activeOrgLabel}>{t('groups.title.activeOrganization')}</Text>
        <Text style={styles.subtitle}>
          {t('groups.subtitle.groupsCount', { count: activeOrganization?.organization.groupCount ?? 0 })}
        </Text>
        <Text style={styles.subtitle}>
          {t('groups.subtitle.membersCount', { count: activeOrganization?.organization.memberCount ?? 0 })}
        </Text>

        <FlatList<OrganizationMembership>
          horizontal
          data={organizations}
          keyExtractor={(item) => item.organizationId}
          renderItem={({ item }) => (
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
          )}
          contentContainerStyle={styles.chipsRow}
          showsHorizontalScrollIndicator={false}
        />
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
            });
          }}
        >
          <Text style={styles.primaryButtonText}>{t('groups.buttons.create')}</Text>
        </Pressable>
      </View>

      {groupsQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#0B6E4F" />
        </View>
      ) : (
        <FlatList<Group>
          data={groupsQuery.data?.items ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.groupCard}>
              <Text style={styles.groupTitle}>{item.name}</Text>
              {item.description ? <Text style={styles.groupDescription}>{item.description}</Text> : null}
              <Text style={styles.groupMeta}>{t('groups.labels.memberCount', { count: item.memberCount })}</Text>
              <View style={styles.groupActionsRow}>
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
                    setMembersGroupId((current) => (current === item.id ? '' : item.id));
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    {membersGroupId === item.id
                      ? t('groups.buttons.hideMembers')
                      : t('groups.buttons.viewMembers')}
                  </Text>
                </Pressable>
              </View>

              {membersGroupId === item.id ? (
                <View style={styles.membersPanel}>
                  {groupMembersQuery.isLoading ? (
                    <ActivityIndicator size="small" color="#0B6E4F" />
                  ) : (
                    <FlatList<GroupMember>
                      data={groupMembersQuery.data?.items ?? []}
                      keyExtractor={(member) => member.userId + member.joinedAt}
                      renderItem={({ item: member }) => (
                        <View style={styles.memberRow}>
                          <Text style={styles.memberName}>{member.displayName}</Text>
                          <Text style={styles.memberMeta}>
                            {t('groups.labels.memberDate', {
                              date: new Date(member.joinedAt).toLocaleDateString(),
                            })}
                          </Text>
                        </View>
                      )}
                      scrollEnabled={false}
                      ListEmptyComponent={<Text style={styles.subtitle}>{t('groups.subtitle.noMembers')}</Text>}
                    />
                  )}
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.subtitle}>{t('groups.subtitle.noGroups')}</Text>
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
