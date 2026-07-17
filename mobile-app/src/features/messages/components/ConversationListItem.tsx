import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
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
      <View style={styles.itemRow}>
        <View style={styles.avatarCircle}>
          {conversation.type === 'direct' ? (
            <Text style={styles.avatarText}>{title.slice(0, 1).toUpperCase()}</Text>
          ) : (
            <MaterialIcons name="groups" size={22} color="#6B7280" />
          )}
        </View>
        <View style={styles.titleColumn}>
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
        </View>
      </View>
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
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 19,
  },
  titleColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  preview: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
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
