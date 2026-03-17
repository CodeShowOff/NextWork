import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Message } from '../types';
import { useSessionStore } from '../../../shared/session/session.store';

interface Props {
  message: Message;
  status?: 'sending' | 'sent' | 'read';
  onLongPress?: () => void;
}

function MessageBubbleView({ message, status, onLongPress }: Props) {
  const { t } = useTranslation();
  const userId = useSessionStore((state) => state.userId);
  const isMine = message.senderId === userId;
  const statusLabel =
    status === 'sending'
      ? t('messages.bubble.statusSending')
      : status === 'read'
        ? t('messages.bubble.statusRead')
        : t('messages.bubble.statusSent');

  return (
    <View style={[styles.row, isMine ? styles.mineRow : styles.theirRow]}>
      <Pressable
        style={[styles.bubble, isMine ? styles.mineBubble : styles.theirBubble]}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={isMine ? message.body : `${message.sender.displayName}: ${message.body}`}
      >
        {!isMine ? <Text style={styles.sender}>{message.sender.displayName}</Text> : null}
        <Text style={[styles.body, isMine ? styles.mineBody : styles.theirBody]}>{message.body}</Text>
        {message.editedAt ? (
          <Text style={[styles.editedText, isMine ? styles.mineEditedText : styles.theirEditedText]}>
            {t('messages.bubble.edited')}
          </Text>
        ) : null}
        {isMine && status ? <Text style={styles.statusText}>{statusLabel}</Text> : null}
      </Pressable>
    </View>
  );
}

export const MessageBubble = React.memo(MessageBubbleView, (previous, next) => {
  return (
    previous.message.id === next.message.id &&
    previous.message.body === next.message.body &&
    previous.message.senderId === next.message.senderId &&
    previous.message.sender.displayName === next.message.sender.displayName &&
    previous.message.editedAt === next.message.editedAt &&
    previous.status === next.status &&
    previous.onLongPress === next.onLongPress
  );
});

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    marginBottom: 8,
    width: '100%',
  },
  mineRow: {
    alignItems: 'flex-end',
  },
  theirRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mineBubble: {
    backgroundColor: '#0B6E4F',
  },
  theirBubble: {
    backgroundColor: '#E2E8F0',
  },
  sender: {
    color: '#334155',
    fontSize: 11,
    marginBottom: 2,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
  },
  mineBody: {
    color: '#FFFFFF',
  },
  theirBody: {
    color: '#0F172A',
  },
  statusText: {
    marginTop: 4,
    color: '#D1FAE5',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
  editedText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
  },
  mineEditedText: {
    color: '#A7F3D0',
    textAlign: 'right',
  },
  theirEditedText: {
    color: '#64748B',
  },
});
