import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Message } from '../types';
import { MessageBubble } from '../components/MessageBubble';
import { MessageComposer } from '../components/MessageComposer';
import { useMessages } from '../hooks/useMessages';
import { useSendMessage } from '../hooks/useSendMessage';
import { MessagesStackParamList } from './MessagesStack';
import { useSessionStore } from '../../../shared/session/session.store';
import { getMessagesSocket } from '../../../shared/realtime/messages.socket';
import {
  addMessageReaction,
  MessageReactionType,
  removeMessageReaction,
  updateMessage,
} from '../../../shared/api/messages.api';
import { messagesKeys } from '../hooks/keys';
import { featureFlags } from '../../../shared/config/runtime';

type Props = NativeStackScreenProps<MessagesStackParamList, 'ConversationDetail'>;

const reactionPickerOrder: MessageReactionType[] = [
  'thumbsup',
  'heart',
  'laughing',
  'astonished',
  'cry',
  'angry',
];

const reactionLabelByType: Record<MessageReactionType, string> = {
  thumbsup: '+1',
  heart: 'Love',
  laughing: 'Haha',
  astonished: 'Wow',
  cry: 'Sad',
  angry: 'Angry',
};

export function ConversationDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const { conversationId } = route.params;
  const currentUserId = useSessionStore((state) => state.userId);
  const messagesQuery = useMessages(conversationId);
  const sendMutation = useSendMessage(conversationId);
  const queryClient = useQueryClient();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');
  const [reactionTargetMessageId, setReactionTargetMessageId] = useState<string | null>(null);

  const editMessageMutation = useMutation({
    mutationFn: (payload: { messageId: string; body: string }) =>
      updateMessage(conversationId, payload.messageId, { body: payload.body }),
    onSuccess: (updated) => {
      setEditingMessageId(null);
      setEditingBody('');

      queryClient.setQueryData(messagesKeys.conversationMessages(conversationId), (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          pages: current.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: Message) => (item.id === updated.id ? { ...item, ...updated } : item)),
          })),
        };
      });
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async (payload: { messageId: string; reactionType: MessageReactionType; remove: boolean }) => {
      if (payload.remove) {
        return removeMessageReaction(payload.messageId, payload.reactionType);
      }

      return addMessageReaction(payload.messageId, payload.reactionType);
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: messagesKeys.conversationMessages(conversationId) });
      const previous = queryClient.getQueryData(messagesKeys.conversationMessages(conversationId));

      queryClient.setQueryData(messagesKeys.conversationMessages(conversationId), (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          pages: current.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: Message) => {
              if (item.id !== payload.messageId) {
                return item;
              }

              if (payload.remove) {
                return {
                  ...item,
                  reactions: item.reactions
                    .map((reaction) => {
                      if (reaction.reactionType !== payload.reactionType) {
                        return reaction.reactedByMe ? { ...reaction, reactedByMe: false } : reaction;
                      }

                      return {
                        ...reaction,
                        count: Math.max(0, reaction.count - 1),
                        reactedByMe: false,
                      };
                    })
                    .filter((reaction) => reaction.count > 0),
                };
              }

              const withoutMine = item.reactions
                .map((reaction) =>
                  reaction.reactedByMe
                    ? { ...reaction, reactedByMe: false, count: Math.max(0, reaction.count - 1) }
                    : reaction,
                )
                .filter((reaction) => reaction.count > 0);

              const target = withoutMine.find((reaction) => reaction.reactionType === payload.reactionType);
              if (target) {
                return {
                  ...item,
                  reactions: withoutMine.map((reaction) =>
                    reaction.reactionType === payload.reactionType
                      ? { ...reaction, count: reaction.count + 1, reactedByMe: true }
                      : reaction,
                  ),
                };
              }

              return {
                ...item,
                reactions: [
                  ...withoutMine,
                  {
                    reactionType: payload.reactionType,
                    count: 1,
                    reactedByMe: true,
                  },
                ],
              };
            }),
          })),
        };
      });

      return { previous };
    },
    onSuccess: (result, payload) => {
      queryClient.setQueryData(messagesKeys.conversationMessages(conversationId), (current: any) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          pages: current.pages.map((page: any) => ({
            ...page,
            items: page.items.map((item: Message) =>
              item.id === payload.messageId
                ? {
                    ...item,
                    reactions: result.reactions,
                  }
                : item,
            ),
          })),
        };
      });
    },
    onError: (error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(messagesKeys.conversationMessages(conversationId), context.previous);
      }

      Alert.alert(t('messages.alerts.reactionFailedTitle'), (error as Error).message);
    },
  });

  const messages = useMemo(
    () => messagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [messagesQuery.data],
  );
  const keyExtractor = useCallback((item: Message) => item.id, []);

  const renderMessageItem = useCallback(
    ({ item }: { item: Message }) => {
      const isMine = item.senderId === currentUserId;
      const isOptimistic = item.id.startsWith('optimistic-');

      const status = !isMine
        ? undefined
        : isOptimistic
          ? 'sending'
          : messagesQuery.lastReadByOtherMessageId === item.id
            ? 'read'
            : 'sent';

      return (
        <MessageBubble
          message={item}
          status={status}
          onLongPress={
            !isOptimistic
              ? () => {
                  setReactionTargetMessageId((current) => (current === item.id ? null : item.id));
                }
              : undefined
          }
        />
      );
    },
    [currentUserId, messagesQuery.lastReadByOtherMessageId],
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
      {featureFlags.flashListRendering ? (
        <FlashList<Message>
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessageItem}
          extraData={messagesQuery.lastReadByOtherMessageId ?? ''}
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
      ) : (
        <FlatList<Message>
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessageItem}
          extraData={messagesQuery.lastReadByOtherMessageId ?? ''}
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
      )}
      {typingLabel ? <Text style={styles.typingText}>{typingLabel}</Text> : null}
      {editingMessageId ? (
        <View style={styles.editBar}>
          <TextInput
            value={editingBody}
            onChangeText={setEditingBody}
            style={styles.editInput}
            placeholder={t('messages.detail.editMessagePlaceholder')}
            accessibilityLabel={t('messages.detail.editMessagePlaceholder')}
          />
          <Pressable
            style={styles.editActionButton}
            onPress={() => {
              const nextBody = editingBody.trim();
              if (!nextBody || !editingMessageId) {
                return;
              }

              editMessageMutation.mutate({ messageId: editingMessageId, body: nextBody });
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.actions.save')}
          >
            <Text style={styles.editActionText}>{t('common.actions.save')}</Text>
          </Pressable>
          <Pressable
            style={styles.editCancelButton}
            onPress={() => {
              setEditingMessageId(null);
              setEditingBody('');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('common.actions.cancel')}
          >
            <Text style={styles.editCancelText}>{t('common.actions.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}
      {reactionTargetMessageId ? (
        <View style={styles.reactionPickerBar}>
          {reactionPickerOrder.map((reactionType) => (
            <Pressable
              key={reactionType}
              style={styles.reactionPickerChip}
              onPress={() => {
                const target = messages.find((message) => message.id === reactionTargetMessageId);
                if (!target) {
                  return;
                }

                const mine = target.reactions.find((reaction) => reaction.reactedByMe);
                const remove = mine?.reactionType === reactionType;

                reactionMutation.mutate({
                  messageId: reactionTargetMessageId,
                  reactionType,
                  remove,
                });
                setReactionTargetMessageId(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={reactionLabelByType[reactionType]}
            >
              <Text style={styles.reactionPickerChipText}>{reactionLabelByType[reactionType]}</Text>
            </Pressable>
          ))}
          {messages.find((message) => message.id === reactionTargetMessageId)?.senderId === currentUserId ? (
            <Pressable
              style={styles.reactionPickerEdit}
              onPress={() => {
                const target = messages.find((message) => message.id === reactionTargetMessageId);
                if (!target) {
                  return;
                }

                setEditingMessageId(target.id);
                setEditingBody(target.body);
                setReactionTargetMessageId(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('common.actions.edit')}
            >
              <Text style={styles.reactionPickerEditText}>{t('common.actions.edit')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.reactionPickerClose}
            onPress={() => setReactionTargetMessageId(null)}
            accessibilityRole="button"
            accessibilityLabel={t('common.actions.cancel')}
          >
            <Text style={styles.reactionPickerCloseText}>{t('common.actions.cancel')}</Text>
          </Pressable>
        </View>
      ) : null}
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
        onSend={(input, onSent) => {
          sendMutation.mutate(input, {
            onSuccess: () => {
              onSent();
            },
            onError: (error) => {
              Alert.alert(t('messages.alerts.sendAttachmentFailedTitle'), (error as Error).message);
            },
          });
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
  editBar: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingTop: 10,
    gap: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  editActionButton: {
    borderRadius: 10,
    backgroundColor: '#0B6E4F',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  editActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  editCancelButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 6,
  },
  editCancelText: {
    color: '#334155',
    fontWeight: '600',
  },
  reactionPickerBar: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  reactionPickerChip: {
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#DCFCE7',
  },
  reactionPickerChipText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
  },
  reactionPickerClose: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reactionPickerCloseText: {
    color: '#334155',
    fontWeight: '600',
  },
  reactionPickerEdit: {
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#ECFDF5',
  },
  reactionPickerEditText: {
    color: '#166534',
    fontWeight: '700',
  },
});
