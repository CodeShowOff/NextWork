import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Conversation } from '../types';
import { useSessionStore } from '../../../shared/session/session.store';

interface Props {
  conversation: Conversation;
  onPress: () => void;
}

function ConversationListItemView({ conversation, onPress }: Props) {
  const { t } = useTranslation();
  const currentUserId = useSessionStore((state) => state.userId);
  const title =
    conversation.type === 'direct'
      ? conversation.participants.find((participant) => participant.userId !== currentUserId)?.displayName ??
        t('messages.list.directChatFallback')
      : conversation.participants.map((participant) => participant.displayName).join(', ');

  return (
    <Pressable style={styles.root} onPress={onPress}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {conversation.unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{conversation.unreadCount}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.preview}>
        {conversation.lastMessage?.body ?? t('messages.list.noMessagesYet')}
      </Text>
    </Pressable>
  );
}

export const ConversationListItem = React.memo(ConversationListItemView, (previous, next) => {
  return (
    previous.conversation.id === next.conversation.id &&
    previous.conversation.type === next.conversation.type &&
    previous.conversation.unreadCount === next.conversation.unreadCount &&
    previous.conversation.lastMessage?.id === next.conversation.lastMessage?.id &&
    previous.conversation.lastMessage?.body === next.conversation.lastMessage?.body &&
    previous.conversation.lastMessage?.createdAt === next.conversation.lastMessage?.createdAt &&
    previous.conversation.participants.length === next.conversation.participants.length &&
    previous.conversation.participants.every((participant, index) => {
      const nextParticipant = next.conversation.participants[index];
      return (
        participant.userId === nextParticipant?.userId && participant.displayName === nextParticipant?.displayName
      );
    }) &&
    previous.onPress === next.onPress
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  preview: {
    marginTop: 6,
    fontSize: 14,
    color: '#475569',
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D91E18',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
