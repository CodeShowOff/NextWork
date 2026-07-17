import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getGroup, listGroupMembers, updateGroupMemberRole } from '../../shared/api/groups.api';
import { AppAvatar, AppButton, AppCard, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing } from '../../shared/ui/design-tokens';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupMembers'>;

export function GroupMembersScreen({ route }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const groupQuery = useQuery({ queryKey: ['groups', 'detail', route.params.groupId], queryFn: () => getGroup(route.params.groupId) });
  const membersQuery = useQuery({ queryKey: ['groups', route.params.groupId, 'members'], queryFn: () => listGroupMembers(route.params.groupId) });
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'owner' | 'admin' | 'member' }) => updateGroupMemberRole(route.params.groupId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups', route.params.groupId, 'members'] }),
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  if (membersQuery.isLoading || groupQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  if (membersQuery.isError || !membersQuery.data) return <AppScreen><AppState kind="error" title={t('ui.states.errorTitle')} body={t('ui.states.errorBody')} action={{ label: t('ui.actions.retry'), onPress: () => membersQuery.refetch() }} /></AppScreen>;
  const canManage = groupQuery.data?.canManage;
  return <AppScreen scroll contentStyle={styles.content}>{membersQuery.data.items.map((member) => <AppCard key={member.userId} style={styles.card}><AppListRow title={member.displayName} subtitle={t(`ui.groups.role${member.role?.slice(0, 1).toUpperCase()}${member.role?.slice(1)}`)} leading={<AppAvatar name={member.displayName} />} />{canManage && member.role !== 'owner' ? <AppButton label={member.role === 'admin' ? t('ui.groups.makeMember') : t('ui.groups.makeAdmin')} variant="secondary" loading={roleMutation.isPending} onPress={() => roleMutation.mutate({ userId: member.userId, role: member.role === 'admin' ? 'member' : 'admin' })} /> : null}</AppCard>)}</AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.sm }, card: { paddingVertical: 0 } });
