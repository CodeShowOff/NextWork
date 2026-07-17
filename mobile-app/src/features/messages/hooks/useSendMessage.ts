import { useMutation, useQueryClient } from '@tanstack/react-query';
function localAttachmentId() {
  return `att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


import { sendMessage, SendMessageAttachmentPayload } from '../../../shared/api/messages.api';
import { getMediaStatus, uploadAttachmentWithContract } from '../../../shared/api/media.api';
import { i18n } from '../../../shared/i18n/i18n';
import { useSessionStore } from '../../../shared/session/session.store';
import { Message } from '../types';
import { insertLocalMessage, removeLocalMessage } from './useMessages';

export type ComposerAttachment = {
  id: string;
  localUri: string;
  fileName: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4' | 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' | 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  status: 'pending' | 'uploading' | 'scanning' | 'failed' | 'uploaded';
  mediaId?: string;
  objectKey?: string;
  errorMessage?: string;
};

export interface SendMessageInput {
  body: string;
  attachments: ComposerAttachment[];
  onAttachmentStateChange?: (attachmentId: string, patch: Partial<ComposerAttachment>) => void;
}

const RETRY_DELAYS_MS = [1000, 2000, 4000];

function toMediaType(contentType: ComposerAttachment['contentType']): SendMessageAttachmentPayload['mediaType'] {
  if (contentType.startsWith('image/')) {
    return 'image';
  }

  if (contentType.startsWith('video/')) {
    return 'video';
  }

  return 'document';
}

async function waitFor(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForScan(mediaId: string, onAttachmentStateChange?: (attachmentId: string, patch: Partial<ComposerAttachment>) => void, attachmentId?: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await getMediaStatus(mediaId);
    if (status.status === 'available') return status;
    if (status.status === 'quarantined' || status.status === 'rejected' || status.status === 'deleted') {
      throw new Error(status.scanDetail ?? i18n.t('messages.composer.scanRejected'));
    }
    if (attachmentId) onAttachmentStateChange?.(attachmentId, { status: 'scanning' });
    await waitFor(1000);
  }
  throw new Error(i18n.t('messages.composer.scanPending'));
}

async function uploadWithRetry(
  attachment: ComposerAttachment,
  onAttachmentStateChange?: (attachmentId: string, patch: Partial<ComposerAttachment>) => void,
) {
  onAttachmentStateChange?.(attachment.id, { status: 'uploading', errorMessage: undefined });

  let lastError: Error | null = null;
  for (let index = 0; index <= RETRY_DELAYS_MS.length; index += 1) {
    try {
      const contract = attachment.mediaId && attachment.objectKey
        ? { mediaId: attachment.mediaId, objectKey: attachment.objectKey, sizeBytes: attachment.sizeBytes, completion: { status: 'scanning' as const } }
        : await uploadAttachmentWithContract({
          localUri: attachment.localUri,
          fileName: attachment.fileName,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
        });

      onAttachmentStateChange?.(attachment.id, { mediaId: contract.mediaId, objectKey: contract.objectKey, status: 'scanning', errorMessage: undefined });
      const scanned = await waitForScan(contract.mediaId, onAttachmentStateChange, attachment.id);

      onAttachmentStateChange?.(attachment.id, { status: 'uploaded', errorMessage: undefined });

      const payload: SendMessageAttachmentPayload = {
        attachmentId: localAttachmentId(),
        mediaId: contract.mediaId,
        mediaType: toMediaType(attachment.contentType),
        mimeType: attachment.contentType,
        fileName: attachment.fileName,
        fileSizeBytes: scanned.sizeBytes,
        storageKey: contract.objectKey,
        ...(attachment.width !== undefined ? { width: attachment.width } : {}),
        ...(attachment.height !== undefined ? { height: attachment.height } : {}),
        ...(attachment.durationMs !== undefined ? { durationMs: attachment.durationMs } : {}),
      };

      return payload;
    } catch (error) {
      lastError = error as Error;
      if (index >= RETRY_DELAYS_MS.length) {
        break;
      }
      await waitFor(RETRY_DELAYS_MS[index]);
    }
  }

  onAttachmentStateChange?.(attachment.id, {
    status: 'failed',
    errorMessage: lastError?.message ?? i18n.t('messages.composer.uploadFailed'),
  });
  throw lastError ?? new Error(i18n.t('messages.composer.uploadFailed'));
}

function optimisticMessage(conversationId: string, text: string, userId: string): Message {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${Date.now()}`,
    conversationId,
    senderId: userId,
    body: text,
    messageType: 'text',
    attachments: [],
    reactions: [],
    createdAt: now,
    editedAt: null,
    sender: {
      id: userId,
      displayName: i18n.t('messages.composer.you'),
      avatarUrl: null,
    },
  };
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.userId);

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const uploadedAttachments: SendMessageAttachmentPayload[] = [];
      for (const attachment of input.attachments) {
        const uploaded = await uploadWithRetry(attachment, input.onAttachmentStateChange);
        uploadedAttachments.push(uploaded);
      }

      const trimmedBody = input.body.trim();
      return sendMessage(conversationId, {
        ...(trimmedBody ? { body: trimmedBody } : {}),
        ...(uploadedAttachments.length ? { attachments: uploadedAttachments } : {}),
        messageType: uploadedAttachments.length ? 'attachment' : 'text',
      });
    },
    onMutate: async (input) => {
      const optimistic = optimisticMessage(conversationId, input.body.trim(), userId);
      insertLocalMessage(queryClient, conversationId, optimistic);
      return { optimisticId: optimistic.id };
    },
    onSuccess: (result, _body, context) => {
      if (context?.optimisticId) {
        removeLocalMessage(queryClient, conversationId, context.optimisticId);
      }
      insertLocalMessage(queryClient, conversationId, result);
    },
    onError: (_error, _body, context) => {
      if (context?.optimisticId) {
        removeLocalMessage(queryClient, conversationId, context.optimisticId);
      }
    },
  });
}
