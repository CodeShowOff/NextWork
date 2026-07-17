import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { NotificationListItem } from '../components/NotificationListItem';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../hooks/useNotifications';
import { notificationsKeys } from '../hooks/keys';
import { NotificationItem } from '../types';
import {
  getNotificationPreferences,
  listMutedNotificationUsers,
  muteNotificationUser,
  openNotification,
  unmuteNotificationUser,
  updateNotificationPreferences,
} from '../../../shared/api/notifications.api';
import { PaginatedFeed } from '../../../shared/api/feed.api';
import { resolveNotificationNavigationAction } from '../navigation/notification-navigation';
import { featureFlags } from '../../../shared/config/runtime';

export function NotificationsScreen() {
    const NotificationsListComponent = featureFlags.flashListRendering ? FlashList : FlatList;

  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const notificationsQuery = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const preferencesQuery = useQuery({
    queryKey: notificationsKeys.preferences(),
    queryFn: getNotificationPreferences,
  });

  const mutedUsersQuery = useQuery({
    queryKey: notificationsKeys.mutedUsers(),
    queryFn: listMutedNotificationUsers,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(notificationsKeys.preferences(), updated);
    },
  });

  const muteMutation = useMutation({
    mutationFn: muteNotificationUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.mutedUsers() });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.list() });
    },
  });

  const unmuteMutation = useMutation({
    mutationFn: unmuteNotificationUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.mutedUsers() });
    },
  });

  const items = useMemo(
    () => notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [notificationsQuery.data],
  );
  const mutedActorIdSet = useMemo(
    () => new Set((mutedUsersQuery.data?.items ?? []).map((item) => item.userId)),
    [mutedUsersQuery.data?.items],
  );
  const mutedActorIds = useMemo(() => Array.from(mutedActorIdSet).sort().join(','), [mutedActorIdSet]);

  const routeToEntity = useCallback(
    (item: NotificationItem) => {
      const rootNavigation = navigation as any;
      const feed = queryClient.getQueryData<{ pageParams: unknown[]; pages: PaginatedFeed[] }>(['feed']);
      const action = resolveNotificationNavigationAction({ item, feedCache: feed });

      if (!action) {
        return;
      }

      if (action.target === 'messages') {
        rootNavigation.navigate('Messages', action.params);
        return;
      }

      if (action.target === 'profile') {
        rootNavigation.navigate('Profile', action.params);
        return;
      }

      rootNavigation.navigate('Feed', action.params);
      if (action.needsFeedRefresh) {
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        Alert.alert(
          action.warningMessage ?? t('notifications.alerts.postUnavailableTitle'),
          t('notifications.alerts.postUnavailableBody'),
        );
      }
    },
    [navigation, queryClient, t],
  );

  const keyExtractor = useCallback((item: NotificationItem) => item.id, []);

  const renderNotificationItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationListItem
        item={item}
        isActorMuted={Boolean(item.actorId && mutedActorIdSet.has(item.actorId))}
        onPress={async () => {
          const opened = await openNotification(item.id).catch(async () => {
            if (!item.isRead) {
              await markRead(item.id).catch(() => {
                // Keep UI responsive; list will sync again on next refresh.
              });
            }

            return null;
          });

          if (!opened) {
            routeToEntity(item);
            return;
          }

          if (opened.action.target === 'messages') {
            (navigation as any).navigate('Messages', {
              screen: 'ConversationDetail',
              params: { conversationId: opened.action.entityId },
            });
            return;
          }

          if (opened.action.target === 'profile') {
            (navigation as any).navigate('Profile', {
              screen: 'UserProfile',
              params: { userId: opened.action.entityId },
            });
            return;
          }

          routeToEntity({ ...item, entityType: opened.action.entityType, entityId: opened.action.entityId });
        }}
        onLongPress={() => {
          const actorId = item.actorId;
          if (!actorId || !item.actor) {
            return;
          }

          const isMuted = mutedActorIdSet.has(actorId);

          Alert.alert(
            isMuted ? t('notifications.alerts.unmuteTitle') : t('notifications.alerts.muteTitle'),
            isMuted
              ? t('notifications.alerts.unmuteBody', { name: item.actor.displayName })
              : t('notifications.alerts.muteBody', { name: item.actor.displayName }),
            [
              { text: t('common.actions.cancel'), style: 'cancel' },
              {
                text: isMuted ? t('notifications.actions.unmute') : t('common.actions.mute'),
                style: 'destructive',
                onPress: () => {
                  if (isMuted) {
                    unmuteMutation.mutate(actorId);
                  } else {
                    muteMutation.mutate(actorId);
                  }
                },
              },
            ],
          );
        }}
      />
    ),
    [markRead, muteMutation, mutedActorIdSet, navigation, routeToEntity, t, unmuteMutation],
  );

  if (notificationsQuery.isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('notifications.title')}</Text>
        <Pressable
          style={styles.markAllButton}
          onPress={() => {
            markAllRead().catch(() => {
              // Keep UI responsive; list will sync again on next refresh.
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('notifications.markAllRead')}
        >
          <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
        </Pressable>
      </View>

      <View style={styles.preferencesCard}>
        <Text style={styles.sectionTitle}>{t('notifications.preferences.title')}</Text>
        {preferencesQuery.isLoading ? (
          <ActivityIndicator size="small" color="#16A34A" />
        ) : (
          <>
            {[
              { key: 'likeEnabled', label: t('notifications.preferences.likes') },
              { key: 'commentEnabled', label: t('notifications.preferences.comments') },
              { key: 'followEnabled', label: t('notifications.preferences.follows') },
              { key: 'messageEnabled', label: t('notifications.preferences.messages') },
            ].map((entry) => {
              const enabled = Boolean(
                preferencesQuery.data?.[entry.key as keyof NonNullable<typeof preferencesQuery.data>],
              );

              return (
                <View style={styles.preferenceRow} key={entry.key}>
                  <Text style={styles.preferenceLabel}>{entry.label}</Text>
                  <Switch
                    value={enabled}
                    onValueChange={(nextValue) => {
                      updatePreferencesMutation.mutate({ [entry.key]: nextValue });
                    }}
                    thumbColor="#FFFFFF"
                    trackColor={{ true: '#16A34A', false: '#94A3B8' }}
                    accessibilityLabel={entry.label}
                    accessibilityRole="switch"
                  />
                </View>
              );
            })}
          </>
        )}
      </View>

      <View style={styles.preferencesCard}>
        <Text style={styles.sectionTitle}>{t('notifications.mutedActors.title')}</Text>
        {(mutedUsersQuery.data?.items ?? []).length === 0 ? (
          <Text style={styles.emptyMutedText}>{t('notifications.mutedActors.empty')}</Text>
        ) : (
          <View style={styles.mutedUsersWrap}>
            {(mutedUsersQuery.data?.items ?? []).map((mutedUser) => (
              <Pressable
                key={mutedUser.userId}
                style={styles.mutedChip}
                onPress={() => {
                  unmuteMutation.mutate(mutedUser.userId);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t('notifications.actions.unmute')} ${mutedUser.displayName}`}
              >
                <Text style={styles.mutedChipText}>{mutedUser.displayName} ×</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <NotificationsListComponent<NotificationItem>
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderNotificationItem}
        extraData={mutedActorIds}
        onEndReached={() => {
          if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage) {
            notificationsQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          notificationsQuery.isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#16A34A" style={styles.footerSpinner} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.centerState}>
            <Text style={styles.emptyText}>{t('notifications.list.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  markAllButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#16A34A',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  markAllText: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 12,
  },
  footerSpinner: {
    marginVertical: 14,
  },
  preferencesCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    color: '#0F172A',
    fontWeight: '700',
    marginBottom: 8,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  preferenceLabel: {
    color: '#334155',
    fontWeight: '600',
  },
  mutedUsersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mutedChip: {
    borderWidth: 1,
    borderColor: '#16A34A',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mutedChipText: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyMutedText: {
    color: '#64748B',
    fontSize: 12,
  },
  emptyText: {
    color: '#64748B',
  },
});
