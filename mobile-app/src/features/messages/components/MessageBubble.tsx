import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Message } from '../types';
import { useSessionStore } from '../../../shared/session/session.store';

interface Props {
  message: Message;
  status?: 'sending' | 'sent' | 'read';
}

export function MessageBubble({ message, status }: Props) {
  const userId = useSessionStore((state) => state.userId);
  const isMine = message.senderId === userId;

  return (
    <View style={[styles.row, isMine ? styles.mineRow : styles.theirRow]}>
      <View style={[styles.bubble, isMine ? styles.mineBubble : styles.theirBubble]}>
        {!isMine ? <Text style={styles.sender}>{message.sender.displayName}</Text> : null}
        <Text style={[styles.body, isMine ? styles.mineBody : styles.theirBody]}>{message.body}</Text>
        {isMine && status ? (
          <Text style={styles.statusText}>
            {status === 'sending' ? 'Sending...' : status === 'read' ? 'Read' : 'Sent'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

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
});
