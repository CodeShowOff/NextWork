import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getRelationship, followUser, unfollowUser } from '../../../shared/api/follows.api';
import { createConversation } from '../../../shared/api/messages.api';
import { sendThanksProfileAction } from '../../../shared/api/notifications.api';
import { getProfile } from '../../../shared/api/profiles.api';
import { listMyOrganizations } from '../../../shared/api/organizations.api';
import { getCurrentUser } from '../../../shared/api/users.api';
import { AppAvatar, AppButton, AppCard, AppListRow, AppScreen, AppState } from '../../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../../shared/ui/design-tokens';

type StackNavigation = { navigate: (screen: string, params?: unknown) => void; getParent?: () => StackNavigation | undefined };
interface Props { navigation: StackNavigation; userId?: string }

export function ProfileViewScreen({ navigation, userId }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const profileUserId = userId ?? meQuery.data?.id;
  const isOwn = Boolean(profileUserId && profileUserId === meQuery.data?.id);
  const profileQuery = useQuery({ queryKey: ['profiles', profileUserId], queryFn: () => getProfile(profileUserId as string), enabled: Boolean(profileUserId) });
  const relationshipQuery = useQuery({ queryKey: ['follows', 'relationship', profileUserId], queryFn: () => getRelationship(profileUserId as string), enabled: Boolean(profileUserId && !isOwn) });
  const organizationsQuery = useQuery({ queryKey: ['organizations', 'me'], queryFn: listMyOrganizations, enabled: isOwn });
  const followMutation = useMutation({
    mutationFn: async (): Promise<{ isFollowing: boolean }> => relationshipQuery.data?.isFollowing ? unfollowUser(profileUserId!) : followUser(profileUserId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follows', 'relationship', profileUserId] }),
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const messageMutation = useMutation({
    mutationFn: () => createConversation({ type: 'direct', participantIds: [profileUserId!] }),
    onSuccess: (conversation) => {
      const firstParent = navigation.getParent?.();
      const root = firstParent?.getParent?.() ?? firstParent ?? navigation;
      root.navigate('MainTabs', { screen: 'Messages', params: { screen: 'ConversationDetail', params: { conversationId: conversation.id } } });
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const thanksMutation = useMutation({
    mutationFn: () => sendThanksProfileAction({ targetUserId: profileUserId! }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });

  if (meQuery.isLoading || profileQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  if (!profileQuery.data) return <AppScreen><AppState kind="error" title={t('ui.states.errorTitle')} body={t('ui.states.errorBody')} action={{ label: t('ui.actions.retry'), onPress: () => profileQuery.refetch() }} /></AppScreen>;
  const profile = profileQuery.data;
  const canAdmin = Boolean(organizationsQuery.data?.items.some((membership) => membership.role === 'owner' || membership.role === 'admin'));

  return (
    <AppScreen scroll contentStyle={styles.content}>
      <AppCard>
        <View style={styles.identity}><AppAvatar name={profile.displayName} size={64} /><View style={styles.copy}><Text style={[styles.name, { color: colors.text }]}>{profile.displayName}</Text>{profile.jobTitle ? <Text style={{ color: colors.textMuted }}>{profile.jobTitle}</Text> : null}{profile.bio ? <Text style={[styles.bio, { color: colors.textMuted }]}>{profile.bio}</Text> : null}</View></View>
        <View style={styles.metrics}><Metric label={t('profile.metrics.posts')} value={profile.counters.posts} /><Metric label={t('profile.metrics.followers')} value={profile.counters.followers} /><Metric label={t('profile.metrics.following')} value={profile.counters.following} /></View>
      </AppCard>
      <AppCard>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('ui.profile.skills')}</Text>
        {profile.skills.length ? <View style={styles.skills}>{profile.skills.map((skill) => <View key={skill.id} style={[styles.skill, { backgroundColor: colors.surfaceMuted }]}><Text style={{ color: colors.text }}>{skill.name}</Text></View>)}</View> : <Text style={{ color: colors.textMuted }}>{t('ui.profile.noSkills')}</Text>}
        {isOwn ? <AppButton label={t('ui.profile.manageSkills')} variant="secondary" onPress={() => navigation.navigate('Skills')} /> : null}
      </AppCard>
      {isOwn ? <AppCard><AppButton label={t('ui.profile.editProfile')} onPress={() => navigation.navigate('EditProfile')} /><AppButton label={t('ui.actions.settings')} variant="secondary" onPress={() => navigation.getParent?.()?.navigate('Settings')} />{canAdmin ? <AppButton label={t('ui.actions.manage')} variant="secondary" onPress={() => navigation.getParent?.()?.navigate('Admin')} /> : null}</AppCard> : <AppCard><AppButton label={t('ui.actions.message')} onPress={() => messageMutation.mutate()} loading={messageMutation.isPending} /><AppButton label={relationshipQuery.data?.isFollowing ? t('profile.buttons.unfollow') : t('profile.buttons.follow')} variant="secondary" onPress={() => followMutation.mutate()} loading={followMutation.isPending} /><AppButton label={t('profile.buttons.sendThanks')} variant="secondary" onPress={() => thanksMutation.mutate()} loading={thanksMutation.isPending} /></AppCard>}
      <AppCard><AppListRow title={t('ui.profile.memberSince')} subtitle={new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(profile.createdAt))} /></AppCard>
    </AppScreen>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const colors = useAppColors();
  return <View style={styles.metric}><Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text><Text style={{ color: colors.textMuted }}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  identity: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  copy: { flex: 1, gap: spacing.xxs },
  name: { fontSize: 22, fontWeight: '800' },
  bio: { marginTop: spacing.xs, lineHeight: 20 },
  metrics: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: spacing.sm },
  metric: { alignItems: 'center', gap: spacing.xxs },
  metricValue: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  skill: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
