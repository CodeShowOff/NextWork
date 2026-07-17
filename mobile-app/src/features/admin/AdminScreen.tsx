import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { listGroups } from '../../shared/api/groups.api';
import { listMyOrganizations, updateOrganization } from '../../shared/api/organizations.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { AppButton, AppCard, AppField, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';
import type { RootStackParamList } from '../../app/App';

type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;

export function AdminScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const organizationsQuery = useQuery({ queryKey: ['organizations', 'me'], queryFn: listMyOrganizations });
  const active = organizationsQuery.data?.items.find((item) => item.organizationId === meQuery.data?.activeOrganizationId) ?? organizationsQuery.data?.items[0];
  const canManage = active?.role === 'owner' || active?.role === 'admin';
  const [name, setName] = useState('');
  useEffect(() => setName(active?.organization.name ?? ''), [active?.organization.name]);
  const groupsQuery = useQuery({ queryKey: ['groups', active?.organizationId], queryFn: () => listGroups(active!.organizationId), enabled: Boolean(active && canManage) });
  const updateMutation = useMutation({
    mutationFn: () => updateOrganization(active!.organizationId, { name: name.trim() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] }),
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });

  if (meQuery.isLoading || organizationsQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  if (!active || !canManage) return <AppScreen><AppState kind="empty" title={t('ui.admin.notAuthorized')} body={t('ui.admin.notAuthorizedBody')} /></AppScreen>;

  return (
    <AppScreen contentStyle={styles.fill}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}><Text style={[styles.title, { color: colors.text }]}>{t('ui.admin.organization')}</Text><AppCard><AppField label={t('ui.admin.organizationName')} value={name} onChangeText={setName} /><AppButton label={t('ui.actions.save')} onPress={() => updateMutation.mutate()} loading={updateMutation.isPending} disabled={!name.trim()} /></AppCard></View>
        <View style={styles.section}><Text style={[styles.title, { color: colors.text }]}>{t('ui.admin.groupManagement')}</Text><AppCard>{groupsQuery.isLoading ? <AppState kind="loading" title={t('ui.states.loading')} /> : (groupsQuery.data?.items ?? []).map((group) => <AppListRow key={group.id} title={group.name} subtitle={t('ui.groups.members', { count: group.memberCount })} onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Groups', params: { screen: 'GroupHub', params: { groupId: group.id } } })} />)}</AppCard></View>
        <View style={styles.section}><Text style={[styles.title, { color: colors.text }]}>{t('ui.admin.moderation')}</Text><AppCard><AppButton label={t('ui.admin.commentReports')} variant="secondary" onPress={() => navigation.navigate('CommentReports')} /></AppCard></View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.lg, flexGrow: 1 },
  section: { gap: spacing.xs },
  title: { fontSize: 15, fontWeight: '800' },
});
