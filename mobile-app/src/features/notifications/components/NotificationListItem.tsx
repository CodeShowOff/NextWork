import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NotificationItem } from '../types';

interface Props {
  item: NotificationItem;
  onPress: () => void;
  onLongPress?: () => void;
}

function buildMessage(item: NotificationItem, t: (key: string, options?: Record<string, unknown>) => string): string {
  const actor = item.actor?.displayName ?? t('notifications.item.unknownActor');

  switch (item.type) {
    case 'follow':
      return t('notifications.item.follow', { actor });
    case 'like':
      return t('notifications.item.like', { actor });
    case 'comment':
      return t('notifications.item.comment', { actor });
    case 'message':
      return t('notifications.item.message', { actor });
    default:
      return t('notifications.item.fallback', { actor });
  }
}

export function NotificationListItem({ item, onPress, onLongPress }: Props) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={[styles.root, !item.isRead ? styles.unread : null]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <View style={styles.row}>
        <Text style={styles.message}>{buildMessage(item, t)}</Text>
        {!item.isRead ? <View style={styles.dot} /> : null}
      </View>
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      {item.actor ? <Text style={styles.hint}>{t('notifications.item.muteHint')}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  unread: {
    backgroundColor: '#F0FDF4',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  message: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  meta: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 12,
  },
  hint: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 11,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
});
