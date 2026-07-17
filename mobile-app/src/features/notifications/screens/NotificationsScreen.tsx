import React, { useMemo } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { openNotification } from '../../../shared/api/notifications.api';
import { getPost } from '../../../shared/api/feed.api';
import { AppAvatar, AppButton, AppCard, AppListRow, AppScreen, AppState } from '../../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../../shared/ui/design-tokens';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../hooks/useNotifications';
import { NotificationItem } from '../types';

function notificationText(item: NotificationItem, t: (key: string, options?: Record<string, unknown>) => string) {
  const actor = item.actor?.displayName ?? t('notifications.item.unknownActor');
  const keys: Record<string, string> = { follow: 'notifications.item.follow', like: 'notifications.item.like', comment: 'notifications.item.comment', message: 'notifications.item.message', thanks: 'notifications.item.thanks', 'thanks-note': 'notifications.item.thanksNote' };
  return t(keys[item.type] ?? 'notifications.item.fallback', { actor });
}

export function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const navigation = useNavigation() as any;
  const notificationsQuery = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const items = useMemo(() => notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [], [notificationsQuery.data]);
  const open = async (item: NotificationItem) => {
    try {
      const result = await openNotification(item.id);
      const root = navigation.getParent()?.getParent() ?? navigation.getParent() ?? navigation;
      if (result.action.target === 'messages') {
        root.navigate('MainTabs', { screen: 'Messages', params: { screen: 'ConversationDetail', params: { conversationId: result.action.entityId } } });
      } else if (result.action.target === 'profile') {
        root.navigate('Profile', { screen: 'UserProfile', params: { userId: result.action.entityId } });
      } else {
        const post = await getPost(result.action.entityId);
        root.navigate('MainTabs', { screen: 'Feed', params: { screen: 'PostDetail', params: { post } } });
      }
    } catch (error) {
      await markRead(item.id).catch(() => undefined);
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };
  return (
    <AppScreen contentStyle={styles.fill}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<View style={styles.headerAction}><AppButton label={t('ui.actions.markAllRead')} variant="secondary" onPress={() => void markAllRead()} /></View>}
        renderItem={({ item }) => <AppCard style={[styles.card, !item.isRead ? { borderColor: colors.primary } : null]}><AppListRow title={notificationText(item, t)} subtitle={new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))} leading={<AppAvatar name={item.actor?.displayName ?? '?'} />} onPress={() => void open(item)} /></AppCard>}
        refreshing={notificationsQuery.isFetching}
        onRefresh={() => notificationsQuery.refetch()}
        onEndReached={() => { if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) void notificationsQuery.fetchNextPage(); }}
        ListEmptyComponent={notificationsQuery.isLoading ? <AppState kind="loading" title={t('ui.states.loading')} /> : <AppState kind="empty" title={t('ui.states.emptyNotifications')} />}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.xs, flexGrow: 1 },
  headerAction: { alignItems: 'flex-end', marginBottom: spacing.xs },
  card: { paddingVertical: 0 },
});
