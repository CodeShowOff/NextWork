import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { listGroupMembershipRequests, resolveGroupMembershipRequest } from '../../shared/api/groups.api';
import { AppAvatar, AppButton, AppCard, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing } from '../../shared/ui/design-tokens';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupRequests'>;

export function GroupRequestsScreen({ route }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ['groups', route.params.groupId, 'requests'], queryFn: () => listGroupMembershipRequests(route.params.groupId) });
  const resolve = useMutation({ mutationFn: ({ id, action }: { id: string; action: 'approve' | 'decline' }) => resolveGroupMembershipRequest(route.params.groupId, id, action), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups', route.params.groupId, 'requests'] }), onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message) });
  if (requestsQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  if (requestsQuery.isError) return <AppScreen><AppState kind="error" title={t('ui.states.errorTitle')} body={t('ui.states.errorBody')} action={{ label: t('ui.actions.retry'), onPress: () => requestsQuery.refetch() }} /></AppScreen>;
  return <AppScreen scroll contentStyle={styles.content}>{(requestsQuery.data?.items ?? []).map((request) => <AppCard key={request.id}><AppListRow title={request.requester.displayName} subtitle={request.message ?? undefined} leading={<AppAvatar name={request.requester.displayName} />} /><AppButton label={t('ui.actions.approve')} onPress={() => resolve.mutate({ id: request.id, action: 'approve' })} loading={resolve.isPending} /><AppButton label={t('ui.actions.decline')} variant="secondary" onPress={() => resolve.mutate({ id: request.id, action: 'decline' })} disabled={resolve.isPending} /></AppCard>)}{!(requestsQuery.data?.items ?? []).length ? <AppState kind="empty" title={t('ui.groups.noRequests')} /> : null}</AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.sm } });
