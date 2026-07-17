import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { listGroups, listMyGroupInvitations, respondGroupInvitation, Group } from '../../shared/api/groups.api';
import { listMyOrganizations } from '../../shared/api/organizations.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { AppAvatar, AppButton, AppCard, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupsHome'>;
type Filter = 'all' | 'favorites' | 'recent';

export function GroupsHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const organizationsQuery = useQuery({ queryKey: ['organizations', 'me'], queryFn: listMyOrganizations });
  const organizationId = meQuery.data?.activeOrganizationId ?? organizationsQuery.data?.items[0]?.organizationId;
  const groupsQuery = useQuery({
    queryKey: ['groups', organizationId],
    queryFn: () => listGroups(organizationId as string),
    enabled: Boolean(organizationId),
  });
  const invitationsQuery = useQuery({ queryKey: ['groups', 'invitations', 'mine'], queryFn: listMyGroupInvitations });
  const respondInvitation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondGroupInvitation(id, accept),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'invitations', 'mine'] });
    },
  });
  const groups = useMemo(() => {
    const items = groupsQuery.data?.items ?? [];
    if (filter === 'favorites') return items.filter((group) => group.membership?.isFavorite);
    if (filter === 'recent') return [...items].filter((group) => group.membership?.lastVisitedAt).sort((a, b) =>
      String(b.membership?.lastVisitedAt).localeCompare(String(a.membership?.lastVisitedAt)),
    );
    return items;
  }, [filter, groupsQuery.data?.items]);

  if (meQuery.isLoading || organizationsQuery.isLoading || groupsQuery.isLoading) {
    return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  }
  if (groupsQuery.isError) {
    return <AppScreen><AppState kind="error" title={t('ui.states.errorTitle')} body={t('ui.states.errorBody')} action={{ label: t('ui.actions.retry'), onPress: () => groupsQuery.refetch() }} /></AppScreen>;
  }
  if (!organizationId) {
    return <AppScreen><AppState kind="empty" title={t('ui.states.emptyGroups')} body={t('groups.subtitle.noGroups')} /></AppScreen>;
  }

  return (
    <AppScreen contentStyle={styles.fill}>
      <View style={styles.topContent}>
        {(invitationsQuery.data?.items ?? []).map((invite) => <AppCard key={invite.id}><AppListRow title={invite.group.name} subtitle={t('ui.groups.invitedBy', { name: invite.invitedBy.displayName })} leading={<AppAvatar name={invite.group.name} />} /><View style={styles.inviteActions}><AppButton label={t('ui.actions.join')} onPress={() => respondInvitation.mutate({ id: invite.id, accept: true })} loading={respondInvitation.isPending} /><AppButton label={t('ui.actions.decline')} variant="secondary" onPress={() => respondInvitation.mutate({ id: invite.id, accept: false })} disabled={respondInvitation.isPending} /></View></AppCard>)}
        <View style={styles.filterRow}>
          {(['all', 'favorites', 'recent'] as Filter[]).map((value) => {
            const label = value === 'all' ? t('ui.groups.all') : value === 'favorites' ? t('ui.groups.favorites') : t('ui.groups.recent');
            const active = value === filter;
            return (
              <Pressable key={value} onPress={() => setFilter(value)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.filter, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceMuted : colors.surface }]}>
                <Text style={{ color: active ? colors.primary : colors.text, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <AppButton label={t('ui.actions.create')} icon="add" onPress={() => navigation.navigate('GroupCreate', { organizationId })} />
      </View>
      <FlatList<Group>
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={groups.length ? styles.list : styles.emptyList}
        refreshing={groupsQuery.isFetching}
        onRefresh={() => groupsQuery.refetch()}
        ListEmptyComponent={<AppState kind="empty" title={t('ui.states.emptyGroups')} body={t('groups.subtitle.noGroups')} />}
        renderItem={({ item }) => (
          <AppCard style={styles.card}>
            <AppListRow
              title={item.name}
              subtitle={`${item.description ?? item.groupType} | ${t('ui.groups.members', { count: item.memberCount })}`}
              leading={<AppAvatar name={item.name} />}
              onPress={() => navigation.navigate('GroupHub', { groupId: item.id })}
              trailing={<Text style={{ color: colors.textMuted, fontSize: 12 }}>{t(`ui.groups.${item.groupPrivacy.toLowerCase()}`)}</Text>}
            />
          </AppCard>
        )}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topContent: { padding: spacing.md, gap: spacing.sm },
  inviteActions: { flexDirection: 'row', gap: spacing.xs },
  filterRow: { flexDirection: 'row', gap: spacing.xs },
  filter: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.xs },
  emptyList: { flexGrow: 1 },
  card: { paddingVertical: 0 },
});
