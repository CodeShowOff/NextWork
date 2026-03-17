import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { Message } from '../types';
import { MessageBubble } from '../components/MessageBubble';
import { MessageComposer } from '../components/MessageComposer';
import { useMessages } from '../hooks/useMessages';
import { useSendMessage } from '../hooks/useSendMessage';
import { MessagesStackParamList } from './MessagesStack';
import { useSessionStore } from '../../../shared/session/session.store';
import { getMessagesSocket } from '../../../shared/realtime/messages.socket';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationDetail'>;

export function ConversationDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { conversationId } = route.params;
  const currentUserId = useSessionStore((state) => state.userId);
  const messagesQuery = useMessages(conversationId);
  const sendMutation = useSendMessage(conversationId);

  const messages = useMemo(
    () => messagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [messagesQuery.data],
  );

  const senderNames = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const message of messages) {
      if (!mapping[message.senderId]) {
        mapping[message.senderId] = message.sender.displayName;
      }
    }
    return mapping;
  }, [messages]);

  const typingLabel = useMemo(() => {
    const othersTyping = messagesQuery.typingUserIds.filter((userId) => userId !== currentUserId);
    if (!othersTyping.length) {
      return '';
    }

    const names = othersTyping.map((userId) => senderNames[userId] ?? t('messages.detail.unknownActor'));
    if (names.length === 1) {
      return t('messages.detail.typingSingle', { name: names[0] });
    }

    return t('messages.detail.typingMultiple', { names: names.slice(0, 2).join(' and ') });
  }, [currentUserId, messagesQuery.typingUserIds, senderNames, t]);

  if (messagesQuery.isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#0B6E4F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList<Message>
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.senderId === currentUserId;
          const isOptimistic = item.id.startsWith('optimistic-');

          const status = !isMine
            ? undefined
            : isOptimistic
              ? 'sending'
              : messagesQuery.lastReadByOtherMessageId === item.id
                ? 'read'
                : 'sent';

          return <MessageBubble message={item} status={status} />;
        }}
        contentContainerStyle={styles.listContent}
        inverted
        onEndReached={() => {
          if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
            messagesQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          messagesQuery.isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#0B6E4F" style={styles.footerSpinner} />
          ) : null
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{t('messages.detail.empty')}</Text>}
      />
      {typingLabel ? <Text style={styles.typingText}>{typingLabel}</Text> : null}
      <MessageComposer
        isSending={sendMutation.isPending}
        onTypingChange={(isTyping) => {
          const socket = getMessagesSocket();
          if (!socket) {
            return;
          }

          socket.emit(isTyping ? 'typing_start' : 'typing_stop', {
            conversationId,
          });
        }}
        onSend={(text) => {
          sendMutation.mutate(text);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    paddingVertical: 12,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSpinner: {
    marginVertical: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#64748B',
  },
  typingText: {
    color: '#0B6E4F',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
});
