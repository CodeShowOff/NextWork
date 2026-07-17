import React, { useMemo } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';

import { Message } from '../types';
import { getMediaDownload } from '../../../shared/api/media.api';
import { useSessionStore } from '../../../shared/session/session.store';
import { type AppColors, useAppColors } from '../../../shared/ui/design-tokens';

const reactionLabelKeyByType: Record<Message['reactions'][number]['reactionType'], string> = {
  thumbsup: 'messages.reactions.thumbsup',
  heart: 'messages.reactions.heart',
  laughing: 'messages.reactions.laughing',
  astonished: 'messages.reactions.astonished',
  cry: 'messages.reactions.cry',
  angry: 'messages.reactions.angry',
};

interface Props {
  message: Message;
  status?: 'sending' | 'sent' | 'read';
  onLongPress?: () => void;
}

function MessageBubbleView({ message, status, onLongPress }: Props) {
  const { t } = useTranslation();
  const styles = useMessageBubbleStyles();
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
      {!isMine ? (
        <View style={styles.theirAvatarCircle}>
          <Text style={styles.theirAvatarText}>{message.sender.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
      ) : null}
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
            {message.attachments.map((attachment) => <AttachmentPreview key={attachment.attachmentId} attachment={attachment} />)}
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
                  {t(reactionLabelKeyByType[reaction.reactionType])} {reaction.count}
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
    previous.message.attachments.map((attachment) => `${attachment.attachmentId}:${attachment.mediaId ?? ''}:${attachment.fileName}`).join('|') === next.message.attachments.map((attachment) => `${attachment.attachmentId}:${attachment.mediaId ?? ''}:${attachment.fileName}`).join('|') &&
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

function AttachmentPreview({ attachment }: { attachment: Message['attachments'][number] }) {
  const { t } = useTranslation();
  const styles = useMessageBubbleStyles();
  const downloadQuery = useQuery({ queryKey: ['media', 'download', attachment.mediaId], queryFn: () => getMediaDownload(attachment.mediaId as string), enabled: Boolean(attachment.mediaId), staleTime: 240_000 });
  const url = downloadQuery.data?.downloadUrl ?? (attachment.publicUrl || null);
  const open = () => { if (url) void Linking.openURL(url); };
  if (attachment.mediaType === 'image') {
    if (!url) return <View style={styles.imageAttachment}><Text style={styles.openAttachment}>{downloadQuery.isLoading ? t('ui.states.loading') : t('ui.states.errorBody')}</Text></View>;
    return <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={t('messages.bubble.openAttachment', { name: attachment.fileName })}><Image source={{ uri: url }} style={styles.imageAttachment} /></Pressable>;
  }
  if (!url) {
    return <View style={styles.fallbackAttachment}><Text style={styles.fallbackAttachmentTitle}>{attachment.mediaType === 'video' ? t('messages.bubble.video') : t('messages.bubble.document')}</Text><Text style={styles.fallbackAttachmentMeta} numberOfLines={1}>{attachment.fileName}</Text><Text style={styles.openAttachment}>{downloadQuery.isLoading ? t('ui.states.loading') : t('ui.states.errorBody')}</Text></View>;
  }
  return <Pressable onPress={open} style={styles.fallbackAttachment} accessibilityRole="button" accessibilityLabel={t('messages.bubble.openAttachment', { name: attachment.fileName })}><Text style={styles.fallbackAttachmentTitle}>{attachment.mediaType === 'video' ? t('messages.bubble.video') : t('messages.bubble.document')}</Text><Text style={styles.fallbackAttachmentMeta} numberOfLines={1}>{attachment.fileName}</Text><Text style={styles.openAttachment}>{downloadQuery.isLoading ? t('ui.states.loading') : t('messages.bubble.open')}</Text></Pressable>;
}

function useMessageBubbleStyles() {
  const colors = useAppColors();
  return useMemo(() => createStyles(colors), [colors]);
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  row: {
    paddingHorizontal: 14,
    marginBottom: 10,
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  mineRow: {
    alignItems: 'flex-end',
  },
  theirRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  mineBubble: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  theirBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  theirAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  theirAvatarText: {
    color: colors.onPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  sender: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 2,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  mineBody: {
    color: colors.text,
  },
  theirBody: {
    color: colors.text,
  },
  statusText: {
    marginTop: 4,
    color: colors.textMuted,
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
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surface,
  },
  reactionChipMine: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  reactionChipText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
  imageAttachment: {
    width: 200,
    height: 150,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  fallbackAttachment: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceMuted,
  },
  fallbackAttachmentTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  fallbackAttachmentMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  openAttachment: {
    marginTop: 4,
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  mineEditedText: {
    color: colors.textMuted,
    textAlign: 'right',
  },
  theirEditedText: {
    color: colors.textMuted,
  },
});
