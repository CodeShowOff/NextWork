import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Message } from '../types';
import { useSessionStore } from '../../../shared/session/session.store';

const reactionLabelByType: Record<Message['reactions'][number]['reactionType'], string> = {
  thumbsup: '+1',
  heart: 'Love',
  laughing: 'Haha',
  astonished: 'Wow',
  cry: 'Sad',
  angry: 'Angry',
};

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
        {message.attachments.length ? (
          <View style={styles.attachmentsWrap}>
            {message.attachments.map((attachment) => {
              if (attachment.mediaType === 'image') {
                return (
                  <Image
                    key={attachment.attachmentId}
                    source={{ uri: attachment.publicUrl }}
                    style={styles.imageAttachment}
                  />
                );
              }

              if (attachment.mediaType === 'video') {
                return (
                  <View key={attachment.attachmentId} style={styles.fallbackAttachment}>
                    <Text style={styles.fallbackAttachmentTitle}>Video</Text>
                    <Text style={styles.fallbackAttachmentMeta} numberOfLines={1}>
                      {attachment.fileName}
                    </Text>
                  </View>
                );
              }

              return (
                <View key={attachment.attachmentId} style={styles.fallbackAttachment}>
                  <Text style={styles.fallbackAttachmentTitle}>Document</Text>
                  <Text style={styles.fallbackAttachmentMeta} numberOfLines={1}>
                    {attachment.fileName}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}
        {message.reactions.length ? (
          <View style={styles.reactionsWrap}>
            {message.reactions.map((reaction) => (
              <View
                key={reaction.reactionType}
                style={[styles.reactionChip, reaction.reactedByMe ? styles.reactionChipMine : null]}
              >
                <Text style={styles.reactionChipText}>
                  {reactionLabelByType[reaction.reactionType]} {reaction.count}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
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
    previous.message.reactions.length === next.message.reactions.length &&
    previous.message.reactions
      .map((reaction) => `${reaction.reactionType}:${reaction.count}:${reaction.reactedByMe ? 1 : 0}`)
      .join('|') ===
      next.message.reactions
        .map((reaction) => `${reaction.reactionType}:${reaction.count}:${reaction.reactedByMe ? 1 : 0}`)
        .join('|') &&
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
  attachmentsWrap: {
    marginTop: 8,
    gap: 8,
  },
  reactionsWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#F8FAFC',
  },
  reactionChipMine: {
    borderColor: '#0B6E4F',
    backgroundColor: '#DCFCE7',
  },
  reactionChipText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  imageAttachment: {
    width: 200,
    height: 150,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  fallbackAttachment: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  fallbackAttachmentTitle: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  fallbackAttachmentMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  mineEditedText: {
    color: '#A7F3D0',
    textAlign: 'right',
  },
  theirEditedText: {
    color: '#64748B',
  },
});
