import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createGroup, Group, GroupMember, joinGroup, listGroupMembers, listGroups } from '../../shared/api/groups.api';
import { createInviteLink, getInviteByToken, acceptInvite } from '../../shared/api/invites.api';
import {
  listMyOrganizations,
  onboardOrganization,
  OrganizationMembership,
  switchOrganization,
} from '../../shared/api/organizations.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { useInviteLinkStore } from '../../shared/session/invite-link.store';

type GroupsRouteParams = {
  focusGroupId?: string;
  organizationId?: string;
};

export function GroupsScreen() {
  const route = useRoute();
  const queryClient = useQueryClient();
  const [organizationName, setOrganizationName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [lastInviteToken, setLastInviteToken] = useState('');
  const [membersGroupId, setMembersGroupId] = useState('');
  const [pendingOrganizationId, setPendingOrganizationId] = useState('');
  const [pendingFocusGroupId, setPendingFocusGroupId] = useState('');

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

  const onboardMutation = useMutation({
    mutationFn: onboardOrganization,
    onSuccess: () => {
      setOrganizationName('');
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
    },
    onError: (error) => Alert.alert('Could not create organization', (error as Error).message),
  });

  const switchMutation = useMutation({
    mutationFn: switchOrganization,
    onSuccess: () => {
      setPendingOrganizationId('');
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: (error) => {
      setPendingOrganizationId('');
      Alert.alert('Could not switch organization', (error as Error).message);
    },
  });

  const joinGroupMutation = useMutation({
    mutationFn: joinGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups', activeOrganizationId] });
      if (membersGroupId) {
        queryClient.invalidateQueries({ queryKey: ['groups', 'members', membersGroupId] });
      }
      Alert.alert('Joined group', 'You are now a member of this group.');
    },
    onError: (error) => Alert.alert('Could not join group', (error as Error).message),
  });

  const groupMembersQuery = useQuery({
    queryKey: ['groups', 'members', membersGroupId],
    queryFn: () => listGroupMembers(membersGroupId),
    enabled: Boolean(membersGroupId),
  });

  const createGroupMutation = useMutation({
    mutationFn: (payload: { organizationId: string; name: string }) => createGroup(payload),
    onSuccess: () => {
      setGroupName('');
      queryClient.invalidateQueries({ queryKey: ['groups', activeOrganizationId] });
    },
    onError: (error) => Alert.alert('Could not create group', (error as Error).message),
  });

  const createInviteMutation = useMutation({
    mutationFn: (organizationId: string) => createInviteLink({ organizationId, expiresInHours: 24 * 7 }),
    onSuccess: (invite) => {
      setLastInviteToken(invite.token);
    },
    onError: (error) => Alert.alert('Could not create invite', (error as Error).message),
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (token: string) => {
      await getInviteByToken(token);
      return acceptInvite(token);
    },
    onSuccess: (result) => {
      setInviteTokenInput('');
      clearPendingInviteToken();
      setPendingOrganizationId(result.organizationId);
      switchMutation.mutate(result.organizationId);
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      Alert.alert('Invite accepted', 'You have joined the organization.');
    },
    onError: (error) => Alert.alert('Could not accept invite', (error as Error).message),
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
          <Text style={styles.title}>Create your organization</Text>
          <Text style={styles.subtitle}>Start by creating a workspace for your team.</Text>
          <TextInput
            value={organizationName}
            onChangeText={setOrganizationName}
            placeholder="Organization name"
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
            <Text style={styles.primaryButtonText}>Create organization</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Join with invite token</Text>
          <TextInput
            value={inviteTokenInput}
            onChangeText={setInviteTokenInput}
            placeholder="Invite token"
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
            <Text style={styles.primaryButtonText}>Accept invite</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.orgName}>{activeOrganization?.organization.name}</Text>
        <Text style={styles.activeOrgLabel}>Active organization</Text>
        <Text style={styles.subtitle}>Groups: {activeOrganization?.organization.groupCount}</Text>
        <Text style={styles.subtitle}>Members: {activeOrganization?.organization.memberCount}</Text>

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
          <Text style={styles.switchingText}>Switching organization...</Text>
        ) : null}

        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            if (!activeOrganizationId) {
              return;
            }
            createInviteMutation.mutate(activeOrganizationId);
          }}
        >
          <Text style={styles.secondaryButtonText}>Generate invite link</Text>
        </Pressable>
        {lastInviteToken ? <Text style={styles.tokenText}>Invite token: {lastInviteToken}</Text> : null}
      </View>

      <View style={styles.composerRow}>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Create a new group"
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
          <Text style={styles.primaryButtonText}>Create</Text>
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
              <Text style={styles.groupMeta}>{item.memberCount} members</Text>
              <View style={styles.groupActionsRow}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    joinGroupMutation.mutate(item.id);
                  }}
                  disabled={joinGroupMutation.isPending}
                >
                  <Text style={styles.secondaryButtonText}>Join</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setMembersGroupId((current) => (current === item.id ? '' : item.id));
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    {membersGroupId === item.id ? 'Hide members' : 'View members'}
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
                          <Text style={styles.memberMeta}>{new Date(member.joinedAt).toLocaleDateString()}</Text>
                        </View>
                      )}
                      scrollEnabled={false}
                      ListEmptyComponent={<Text style={styles.subtitle}>No members to show.</Text>}
                    />
                  )}
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.subtitle}>No groups yet.</Text>
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
});
