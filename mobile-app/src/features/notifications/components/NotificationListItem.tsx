import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NotificationItem } from '../types';
import { i18n } from '../../../shared/i18n/i18n';

interface Props {
  item: NotificationItem;
  onPress: () => void;
  onLongPress?: () => void;
  isActorMuted?: boolean;
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
    case 'thanks':
      return t('notifications.item.thanks', { actor });
    case 'thanks-note':
      return t('notifications.item.thanksNote', { actor });
    default:
      return t('notifications.item.fallback', { actor });
  }
}

function NotificationListItemView({ item, onPress, onLongPress, isActorMuted = false }: Props) {
  const { t } = useTranslation();
  const message = buildMessage(item, t);
  const createdAtText = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(item.createdAt));

  return (
    <Pressable
      style={[styles.root, !item.isRead ? styles.unread : null]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={message}
      accessibilityHint={t('notifications.item.muteHint')}
    >
      <View style={styles.row}>
        <Text style={styles.message}>{message}</Text>
        {!item.isRead ? <View style={styles.dot} /> : null}
      </View>
      <Text style={styles.meta}>{createdAtText}</Text>
      {isActorMuted ? <Text style={styles.mutedLabel}>{t('notifications.labels.muted')}</Text> : null}
      {item.actor ? <Text style={styles.hint}>{t('notifications.item.muteHint')}</Text> : null}
    </Pressable>
  );
}

export const NotificationListItem = React.memo(NotificationListItemView, (previous, next) => {
  return (
    previous.item.id === next.item.id &&
    previous.item.isRead === next.item.isRead &&
    previous.item.type === next.item.type &&
    previous.item.createdAt === next.item.createdAt &&
    previous.item.actorId === next.item.actorId &&
    previous.item.actor?.displayName === next.item.actor?.displayName &&
    previous.isActorMuted === next.isActorMuted &&
    previous.onPress === next.onPress &&
    previous.onLongPress === next.onLongPress
  );
});

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
  mutedLabel: {
    marginTop: 4,
    color: '#B45309',
    fontWeight: '700',
    fontSize: 11,
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
