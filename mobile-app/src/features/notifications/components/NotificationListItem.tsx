import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NotificationItem } from '../types';

interface Props {
  item: NotificationItem;
  onPress: () => void;
  onLongPress?: () => void;
}

function buildMessage(item: NotificationItem): string {
  const actor = item.actor?.displayName ?? 'Someone';

  switch (item.type) {
    case 'follow':
      return `${actor} started following you`;
    case 'like':
      return `${actor} liked your post`;
    case 'comment':
      return `${actor} commented on your post`;
    case 'message':
      return `${actor} sent you a message`;
    default:
      return `${actor} sent a notification`;
  }
}

export function NotificationListItem({ item, onPress, onLongPress }: Props) {
  return (
    <Pressable
      style={[styles.root, !item.isRead ? styles.unread : null]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      <View style={styles.row}>
        <Text style={styles.message}>{buildMessage(item)}</Text>
        {!item.isRead ? <View style={styles.dot} /> : null}
      </View>
      <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
      {item.actor ? <Text style={styles.hint}>Long press to mute this actor</Text> : null}
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
