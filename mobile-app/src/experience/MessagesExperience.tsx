import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addMessageReaction,
  createConversation,
  removeMessageReaction,
  updateMessage,
} from '../shared/api/messages.api';
import { searchAll } from '../shared/api/search.api';
import { getMessagesSocket } from '../shared/realtime/messages.socket';
import { useSessionStore } from '../shared/session/session.store';
import { radius, spacing, useAppColors } from '../shared/ui/design-tokens';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  ModalSheet,
  SearchField,
  Skeleton,
  TextField,
} from '../presentation/components';
import { useToast } from '../presentation/feedback';
import { Page, TwoPane, useAdaptiveLayout } from '../presentation/layout';
import { OfflineBanner, useNetwork, useStoredDraft } from '../presentation/resilience';
import { ComposerAttachment, useSendMessage } from '../features/messages/hooks/useSendMessage';
import { useConversations, upsertConversation } from '../features/messages/hooks/useConversations';
import { useMessages } from '../features/messages/hooks/useMessages';
import { Conversation, Message, MessageReactionSummary } from '../features/messages/types';
import { RootStackParamList } from './navigation';

type MessagesProps = NativeStackScreenProps<RootStackParamList, 'Main'>;
type ConversationProps = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

const reactions: Array<{
  type: MessageReactionSummary['reactionType'];
  emoji: string;
  label: string;
}> = [
  { type: 'thumbsup', emoji: '👍', label: 'Like' },
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'laughing', emoji: '😄', label: 'Laugh' },
  { type: 'astonished', emoji: '😮', label: 'Wow' },
  { type: 'cry', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
];

export function MessagesExperience({ navigation }: MessagesProps) {
  const colors = useAppColors();
  const layout = useAdaptiveLayout();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const currentUserId = useSessionStore((state) => state.userId);
  const conversationsQuery = useConversations();
  const [newChatVisible, setNewChatVisible] = useState(false);
  const [conversationQuery, setConversationQuery] = useState('');
  const conversations = useMemo(
    () => conversationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [conversationsQuery.data],
  );
  const visibleConversations = useMemo(() => {
    const query = conversationQuery.trim().toLocaleLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) => {
      const people = conversation.participants.map((person) => person.displayName).join(' ');
      return `${people} ${conversation.lastMessage?.body ?? ''}`
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [conversationQuery, conversations]);
  const startConversation = useMutation({
    mutationFn: (userId: string) =>
      createConversation({ type: 'direct', participantIds: [userId] }),
    onSuccess: (conversation) => {
      upsertConversation(queryClient, conversation);
      setNewChatVisible(false);
      navigation.navigate('Conversation', { conversationId: conversation.id });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not start that conversation.' }),
  });

  const list = (
    <FlatList
      data={visibleConversations}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.inboxList}
      showsVerticalScrollIndicator={false}
      refreshing={conversationsQuery.isRefetching}
      onRefresh={() => void conversationsQuery.refetch()}
      onEndReached={() => {
        if (conversationsQuery.hasNextPage && !conversationsQuery.isFetchingNextPage)
          void conversationsQuery.fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={styles.inboxHeading}>
          <View style={styles.inboxTop}>
            <View>
              <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>
                Chats
              </Text>
              <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
                Your conversations, all in one place.
              </Text>
            </View>
            <IconButton
              testID="new-chat"
              icon="edit"
              label="Start a new chat"
              onPress={() => setNewChatVisible(true)}
            />
          </View>
          <OfflineBanner />
          <SearchField
            value={conversationQuery}
            onChangeText={setConversationQuery}
            onClear={() => setConversationQuery('')}
            placeholder="Search conversations"
          />
        </View>
      }
      ListEmptyComponent={
        conversationsQuery.isLoading ? (
          <InboxSkeleton />
        ) : conversationsQuery.isError ? (
          <ErrorState onRetry={() => void conversationsQuery.refetch()} />
        ) : conversationQuery ? (
          <EmptyState
            title="No conversations found"
            body="Try a different name or message."
            icon="search"
          />
        ) : (
          <EmptyState
            title="No conversations yet"
            body="Start a chat with someone in your organization."
            icon="forum"
            action={{ label: 'New chat', onPress: () => setNewChatVisible(true) }}
          />
        )
      }
      renderItem={({ item }) => (
        <ConversationRow
          conversation={item}
          currentUserId={currentUserId}
          onPress={() => navigation.navigate('Conversation', { conversationId: item.id })}
        />
      )}
    />
  );

  return (
    <Page keyboardAware={false} edges={['top', 'left', 'right', 'bottom']}>
      {layout.isCompact ? (
        list
      ) : (
        <TwoPane
          leading={
            <View style={[styles.wideInbox, { borderRightColor: colors.border }]}>{list}</View>
          }
        >
          <View style={styles.chatPlaceholder}>
            <EmptyState
              title="Choose a conversation"
              body="Select a chat to read messages or start a new one."
              icon="chat"
            />
          </View>
        </TwoPane>
      )}
      <NewConversationSheet
        visible={newChatVisible}
        currentUserId={currentUserId}
        onClose={() => setNewChatVisible(false)}
        onSelect={(userId) => startConversation.mutate(userId)}
        loading={startConversation.isPending}
      />
    </Page>
  );
}

function ConversationRow({
  conversation,
  currentUserId,
  onPress,
}: {
  conversation: Conversation;
  currentUserId: string;
  onPress: () => void;
}) {
  const colors = useAppColors();
  const other =
    conversation.type === 'direct'
      ? conversation.participants.find((person) => person.userId !== currentUserId)
      : undefined;
  const title =
    other?.displayName ||
    conversation.participants
      .filter((person) => person.userId !== currentUserId)
      .map((person) => person.displayName)
      .join(', ') ||
    'Conversation';
  const preview =
    conversation.lastMessage?.body ||
    (conversation.lastMessage?.attachments.length ? 'Sent an attachment' : 'No messages yet');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.conversationRow,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.background },
      ]}
    >
      <Avatar
        name={title}
        uri={other?.avatarUrl}
        size={52}
        status={conversation.unreadCount ? 'online' : undefined}
      />
      <View style={styles.conversationCopy}>
        <View style={styles.conversationTitleRow}>
          <Text numberOfLines={1} style={[styles.conversationTitle, { color: colors.text }]}>
            {title}
          </Text>
          {conversation.lastMessage ? (
            <Text style={[styles.time, { color: colors.textSubtle }]}>
              {shortTime(conversation.lastMessage.createdAt)}
            </Text>
          ) : null}
        </View>
        <View style={styles.conversationPreviewRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.conversationPreview,
              {
                color: conversation.unreadCount ? colors.text : colors.textMuted,
                fontWeight: conversation.unreadCount ? '700' : '400',
              },
            ]}
          >
            {preview}
          </Text>
          {conversation.unreadCount ? (
            <View style={[styles.unread, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadText}>
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function NewConversationSheet({
  visible,
  onClose,
  onSelect,
  currentUserId,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (userId: string) => void;
  currentUserId: string;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const peopleQuery = useQuery({
    queryKey: ['search', 'new-chat', query],
    queryFn: () => searchAll({ query, scope: 'users', limit: 12 }),
    enabled: visible && query.trim().length >= 2,
  });
  return (
    <ModalSheet visible={visible} title="New chat" onClose={onClose}>
      <SearchField
        testID="new-chat-search"
        value={query}
        onChangeText={setQuery}
        placeholder="Search people"
        autoFocus={visible}
        onClear={() => setQuery('')}
      />
      {query.trim().length < 2 ? (
        <EmptyState
          title="Find a teammate"
          body="Start typing a name or email address."
          icon="person-search"
        />
      ) : peopleQuery.isLoading ? (
        <InboxSkeleton />
      ) : (
        (peopleQuery.data?.users ?? [])
          .filter((person) => person.id !== currentUserId)
          .map((person) => (
            <ListRow
              key={person.id}
              title={person.displayName}
              subtitle={person.email}
              leading={<Avatar name={person.displayName} uri={person.avatarUrl} />}
              trailing={
                <Button label="Message" onPress={() => onSelect(person.id)} loading={loading} />
              }
            />
          ))
      )}
    </ModalSheet>
  );
}

export function ConversationExperience({ route, navigation }: ConversationProps) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const { isOnline } = useNetwork();
  const currentUserId = useSessionStore((state) => state.userId);
  const conversationId = route.params.conversationId;
  const messagesQuery = useMessages(conversationId);
  const sendMutation = useSendMessage(conversationId);
  const [reactionTarget, setReactionTarget] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [editBody, setEditBody] = useState('');
  const messages = useMemo(
    () => messagesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [messagesQuery.data],
  );
  const editMutation = useMutation({
    mutationFn: () => updateMessage(conversationId, editing!.id, { body: editBody.trim() }),
    onSuccess: () => {
      setEditing(null);
      setEditBody('');
      void messagesQuery.refetch();
    },
    onError: () => showToast({ tone: 'error', message: 'Could not update that message.' }),
  });
  const reactionMutation = useMutation({
    mutationFn: ({
      message,
      type,
    }: {
      message: Message;
      type: MessageReactionSummary['reactionType'];
    }) => {
      const mine = message.reactions.find((reaction) => reaction.reactedByMe);
      return mine?.reactionType === type
        ? removeMessageReaction(message.id, type)
        : addMessageReaction(message.id, type);
    },
    onSuccess: () => {
      setReactionTarget(null);
      void messagesQuery.refetch();
    },
    onError: () => showToast({ tone: 'error', message: 'Could not update reaction.' }),
  });
  const otherName =
    messages.find((message) => message.senderId !== currentUserId)?.sender.displayName ||
    'Conversation';
  const typingText = messagesQuery.typingUserIds.filter((id) => id !== currentUserId).length
    ? 'Someone is typing…'
    : '';

  return (
    <Page edges={['top', 'left', 'right', 'bottom']} style={styles.conversationScreen}>
      <View
        style={[
          styles.conversationHeader,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <IconButton icon="arrow-back" label="Back to chats" onPress={() => navigation.goBack()} />
        <Pressable style={styles.conversationHeaderCopy} onPress={() => undefined}>
          <Avatar name={otherName} size={36} status="online" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.headerName, { color: colors.text }]}>
              {otherName}
            </Text>
            <Text style={[styles.headerStatus, { color: colors.success }]}>Active now</Text>
          </View>
        </Pressable>
        <IconButton
          icon="more-horiz"
          label="Conversation options"
          onPress={() =>
            showToast({ tone: 'info', message: 'Conversation settings are coming soon.' })
          }
        />
      </View>
      <OfflineBanner />
      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage)
            void messagesQuery.fetchNextPage();
        }}
        ListEmptyComponent={
          messagesQuery.isLoading ? (
            <InboxSkeleton />
          ) : (
            <EmptyState
              title="Say hello"
              body="The first message can start a great conversation."
              icon="waving-hand"
            />
          )
        }
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            mine={item.senderId === currentUserId}
            onLongPress={() => setReactionTarget(item)}
          />
        )}
      />
      {typingText ? (
        <Text style={[styles.typing, { color: colors.primary }]}>{typingText}</Text>
      ) : null}
      {editing ? (
        <View
          style={[
            styles.editBar,
            { backgroundColor: colors.surfaceTint, borderTopColor: colors.border },
          ]}
        >
          <TextField value={editBody} onChangeText={setEditBody} multiline style={{ flex: 1 }} />
          <Button
            label="Save"
            onPress={() => editMutation.mutate()}
            loading={editMutation.isPending}
            disabled={!editBody.trim()}
          />
          <IconButton icon="close" label="Cancel editing" onPress={() => setEditing(null)} />
        </View>
      ) : null}
      <MessageComposer
        online={isOnline}
        sending={sendMutation.isPending}
        onTyping={(typing) => {
          const socket = getMessagesSocket();
          socket?.emit(typing ? 'typing_start' : 'typing_stop', { conversationId });
        }}
        onSend={(input, done) =>
          sendMutation.mutate(input, {
            onSuccess: done,
            onError: (error) =>
              showToast({
                tone: 'error',
                message: error instanceof Error ? error.message : 'Could not send message.',
              }),
          })
        }
      />
      <ModalSheet
        visible={Boolean(reactionTarget)}
        title="Message actions"
        onClose={() => setReactionTarget(null)}
      >
        <View style={styles.reactionGrid}>
          {reactions.map((reaction) => (
            <Pressable
              key={reaction.type}
              accessibilityRole="button"
              accessibilityLabel={reaction.label}
              style={[styles.reactionChoice, { backgroundColor: colors.surfaceMuted }]}
              onPress={() =>
                reactionTarget &&
                reactionMutation.mutate({ message: reactionTarget, type: reaction.type })
              }
            >
              <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{reaction.label}</Text>
            </Pressable>
          ))}
        </View>
        {reactionTarget?.senderId === currentUserId ? (
          <Button
            label="Edit message"
            variant="secondary"
            icon="edit"
            onPress={() => {
              setEditing(reactionTarget);
              setEditBody(reactionTarget.body);
              setReactionTarget(null);
            }}
          />
        ) : null}
      </ModalSheet>
    </Page>
  );
}

function MessageBubble({
  message,
  mine,
  onLongPress,
}: {
  message: Message;
  mine: boolean;
  onLongPress: () => void;
}) {
  const colors = useAppColors();
  return (
    <View style={[styles.messageRow, mine ? styles.messageRowMine : null]}>
      {mine ? null : (
        <Avatar name={message.sender.displayName} uri={message.sender.avatarUrl} size={28} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Message actions"
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[
          styles.bubble,
          {
            backgroundColor: mine ? colors.primary : colors.surfaceMuted,
            borderBottomRightRadius: mine ? 5 : radius.md,
            borderBottomLeftRadius: mine ? radius.md : 5,
          },
        ]}
      >
        <Text style={[styles.messageText, { color: mine ? colors.onPrimary : colors.text }]}>
          {message.body || (message.attachments.length ? 'Attachment' : '')}
        </Text>
        {message.attachments.map((attachment) => (
          <View
            key={attachment.attachmentId}
            style={[
              styles.attachmentChip,
              { backgroundColor: mine ? 'rgba(255,255,255,0.17)' : colors.surface },
            ]}
          >
            <Text
              numberOfLines={1}
              style={{ color: mine ? colors.onPrimary : colors.text, maxWidth: 210 }}
            >
              {attachment.fileName}
            </Text>
          </View>
        ))}
        {message.reactions.length ? (
          <View
            style={[
              styles.reactionSummary,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {message.reactions.map((reaction) => (
              <Text key={reaction.reactionType}>
                {reactions.find((item) => item.type === reaction.reactionType)?.emoji}{' '}
                {reaction.count}
              </Text>
            ))}
          </View>
        ) : null}
        <Text
          style={[
            styles.messageTime,
            { color: mine ? 'rgba(255,255,255,0.74)' : colors.textSubtle },
          ]}
        >
          {shortTime(message.createdAt)}
          {message.editedAt ? ' · Edited' : ''}
        </Text>
      </Pressable>
    </View>
  );
}

function MessageComposer({
  online,
  sending,
  onTyping,
  onSend,
}: {
  online: boolean;
  sending: boolean;
  onTyping: (typing: boolean) => void;
  onSend: (
    input: {
      body: string;
      attachments: ComposerAttachment[];
      onAttachmentStateChange: (id: string, patch: Partial<ComposerAttachment>) => void;
    },
    done: () => void,
  ) => void;
}) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const draft = useStoredDraft('workplace.draft.message');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addAttachment = (attachment: ComposerAttachment) =>
    setAttachments((current) => [...current, attachment].slice(0, 5));
  const updateAttachment = (id: string, patch: Partial<ComposerAttachment>) =>
    setAttachments((current) =>
      current.map((attachment) =>
        attachment.id === id ? { ...attachment, ...patch } : attachment,
      ),
    );
  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ tone: 'error', message: 'Photo library access is required to attach media.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType =
      asset.mimeType === 'image/png' ||
      asset.mimeType === 'image/webp' ||
      asset.mimeType === 'video/mp4'
        ? asset.mimeType
        : 'image/jpeg';
    addAttachment({
      id: `att-${Date.now()}`,
      localUri: asset.uri,
      fileName: asset.fileName ?? `attachment-${Date.now()}`,
      contentType,
      sizeBytes: asset.fileSize,
      width: asset.width,
      height: asset.height,
      durationMs: asset.duration ?? undefined,
      status: 'pending',
    });
  };
  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType as ComposerAttachment['contentType'];
    if (!contentType) {
      showToast({ tone: 'error', message: 'This document type is not supported.' });
      return;
    }
    addAttachment({
      id: `doc-${Date.now()}`,
      localUri: asset.uri,
      fileName: asset.name,
      contentType,
      sizeBytes: asset.size,
      status: 'pending',
    });
  };
  const send = () => {
    const body = draft.value.trim();
    if (!body && !attachments.length) return;
    onTyping(false);
    onSend({ body, attachments, onAttachmentStateChange: updateAttachment }, () => {
      draft.clear();
      setAttachments([]);
    });
  };
  return (
    <View
      style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
    >
      {attachments.length ? (
        <View style={styles.composerAttachments}>
          {attachments.map((attachment) => (
            <View
              key={attachment.id}
              style={[styles.composerAttachment, { backgroundColor: colors.surfaceMuted }]}
            >
              <Text numberOfLines={1} style={{ color: colors.text, maxWidth: 180 }}>
                {attachment.fileName}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{attachment.status}</Text>
              <IconButton
                icon="close"
                label={`Remove ${attachment.fileName}`}
                onPress={() =>
                  setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                }
              />
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.composerRow}>
        <IconButton
          icon="add-circle-outline"
          label="Attach photo, video, or file"
          onPress={() => showToast({ tone: 'info', message: 'Choose an attachment type below.' })}
        />
        <TextField
          testID="message-composer"
          value={draft.value}
          onChangeText={(value) => {
            draft.setValue(value);
            onTyping(Boolean(value.trim()));
            if (typingTimer.current) clearTimeout(typingTimer.current);
            typingTimer.current = setTimeout(() => onTyping(false), 1100);
          }}
          placeholder={online ? 'Type a message' : 'Reconnect to send messages'}
          multiline
          editable={online}
          style={{ flex: 1 }}
          inputStyle={{ minHeight: 42, maxHeight: 110 }}
        />
        <IconButton
          icon="image"
          label="Attach photo or video"
          onPress={() => void pickMedia()}
          disabled={!online}
        />
        <IconButton
          icon="attach-file"
          label="Attach document"
          onPress={() => void pickDocument()}
          disabled={!online}
        />
        <IconButton
          testID="message-send"
          icon="send"
          label="Send message"
          onPress={send}
          disabled={!online || sending || (!draft.value.trim() && !attachments.length)}
        />
      </View>
    </View>
  );
}

function InboxSkeleton() {
  return (
    <View style={styles.skeletonInbox}>
      {[0, 1, 2, 3].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <Skeleton width={52} height={52} radius={26} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width="48%" />
            <Skeleton width="80%" height={13} />
          </View>
        </View>
      ))}
    </View>
  );
}
function shortTime(value: string) {
  const date = new Date(value);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  inboxList: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },
  inboxHeading: { gap: spacing.md, marginBottom: spacing.xs },
  inboxTop: {
    minHeight: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },
  conversationRow: {
    minHeight: 74,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationCopy: { flex: 1, minWidth: 0, gap: 3 },
  conversationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  conversationTitle: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  time: { fontSize: 11, lineHeight: 15 },
  conversationPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  conversationPreview: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: 18 },
  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '900' },
  wideInbox: { width: 360, flex: 1, borderRightWidth: StyleSheet.hairlineWidth },
  chatPlaceholder: { flex: 1 },
  conversationScreen: { flex: 1 },
  conversationHeader: {
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  conversationHeaderCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerName: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  headerStatus: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  messageList: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, marginVertical: 2 },
  messageRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 4,
  },
  messageText: { fontSize: 16, lineHeight: 22 },
  messageTime: { alignSelf: 'flex-end', fontSize: 10, lineHeight: 13 },
  attachmentChip: {
    minHeight: 32,
    borderRadius: radius.xs,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  reactionSummary: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
    marginBottom: -18,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  typing: {
    paddingHorizontal: spacing.md,
    paddingBottom: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  editBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  composerAttachments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  composerAttachment: {
    maxWidth: '100%',
    minHeight: 42,
    borderRadius: radius.xs,
    paddingLeft: spacing.xs,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  reactionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reactionChoice: {
    width: '31%',
    minHeight: 76,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  reactionEmoji: { fontSize: 25, lineHeight: 30 },
  skeletonInbox: { gap: spacing.sm },
  skeletonRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
