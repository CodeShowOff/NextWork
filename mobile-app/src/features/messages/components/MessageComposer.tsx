import React, { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import { ComposerAttachment } from '../hooks/useSendMessage';

interface Props {
  isSending: boolean;
  onSend: (
    input: {
      body: string;
      attachments: ComposerAttachment[];
      onAttachmentStateChange: (attachmentId: string, patch: Partial<ComposerAttachment>) => void;
    },
    onSent: () => void,
  ) => void;
  onTypingChange?: (isTyping: boolean) => void;
}

function inferImagePickerContentType(fileName?: string | null, mimeType?: string | null): ComposerAttachment['contentType'] {
  if (
    mimeType === 'image/jpeg' ||
    mimeType === 'image/png' ||
    mimeType === 'image/webp' ||
    mimeType === 'video/mp4'
  ) {
    return mimeType;
  }

  const lower = (fileName ?? '').toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.mp4')) {
    return 'video/mp4';
  }
  return 'image/jpeg';
}

function nextAttachmentId() {
  return `composer-att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function MessageComposer({ isSending, onSend, onTypingChange }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitTypingState = (isTyping: boolean) => {
    if (isTypingRef.current === isTyping) {
      return;
    }

    isTypingRef.current = isTyping;
    onTypingChange?.(isTyping);
  };

  const handleChangeText = (nextValue: string) => {
    setValue(nextValue);

    const hasContent = nextValue.trim().length > 0;
    if (!hasContent) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      emitTypingState(false);
      return;
    }

    emitTypingState(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTypingState(false);
    }, 1200);
  };

  const submit = () => {
    const next = value.trim();
    if (!next && !attachments.length) {
      return;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    emitTypingState(false);

    onSend(
      {
        body: next,
        attachments,
        onAttachmentStateChange: (attachmentId, patch) => {
          setAttachments((current) =>
            current.map((item) => (item.id === attachmentId ? { ...item, ...patch } : item)),
          );
        },
      },
      () => {
        setValue('');
        setAttachments([]);
      },
    );
  };

  const pickAttachment = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('feed.alerts.permissionRequiredTitle'), t('feed.alerts.permissionRequiredBody'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.fileName ?? `attachment-${Date.now()}.jpg`;
    const nextAttachment: ComposerAttachment = {
      id: nextAttachmentId(),
      localUri: asset.uri,
      fileName,
      contentType: inferImagePickerContentType(fileName, asset.mimeType),
      sizeBytes: asset.fileSize,
      width: asset.width,
      height: asset.height,
      durationMs: asset.duration ? Math.round(asset.duration) : undefined,
      status: 'pending',
    };

    setAttachments((current) => [...current, nextAttachment].slice(0, 5));
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  };

  const retryFailedAttachment = (attachmentId: string) => {
    setAttachments((current) =>
      current.map((attachment) =>
        attachment.id === attachmentId
          ? { ...attachment, status: 'pending', errorMessage: undefined }
          : attachment,
      ),
    );
  };

  return (
    <View style={styles.root}>
      {attachments.length ? (
        <View style={styles.attachmentsWrap}>
          {attachments.map((attachment) => (
            <View key={attachment.id} style={styles.attachmentChip}>
              <Text style={styles.attachmentName} numberOfLines={1}>
                {attachment.fileName}
              </Text>
              <Text style={styles.attachmentStatus}>{attachment.status}</Text>
              {attachment.status === 'failed' ? (
                <Pressable
                  style={styles.retryAttachmentButton}
                  onPress={() => retryFailedAttachment(attachment.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.actions.continue')}
                >
                  <Text style={styles.retryAttachmentButtonText}>{t('common.actions.continue')}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => removeAttachment(attachment.id)}
                accessibilityRole="button"
                accessibilityLabel={t('common.actions.remove')}
              >
                <Text style={styles.removeAttachmentText}>{t('common.actions.remove')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        style={styles.attachButton}
        onPress={pickAttachment}
        accessibilityRole="button"
        accessibilityLabel={t('messages.composer.attach')}
      >
        <Text style={styles.attachButtonText}>{t('messages.composer.attach')}</Text>
      </Pressable>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          placeholder={t('messages.composer.placeholder')}
          style={styles.input}
          multiline
          accessibilityLabel={t('messages.composer.placeholder')}
        />
        <Pressable
          style={[styles.button, isSending ? styles.disabledButton : null]}
          onPress={submit}
          accessibilityRole="button"
          accessibilityLabel={t('messages.composer.send')}
        >
          <Text style={styles.buttonText}>{isSending ? t('messages.composer.sending') : t('messages.composer.send')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 10,
    flexDirection: 'column',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  attachmentsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachmentChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    maxWidth: '100%',
    backgroundColor: '#F8FAFC',
  },
  attachmentName: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 200,
  },
  attachmentStatus: {
    color: '#64748B',
    fontSize: 11,
  },
  retryAttachmentButton: {
    alignSelf: 'flex-start',
  },
  retryAttachmentButtonText: {
    color: '#0B6E4F',
    fontWeight: '700',
    fontSize: 12,
  },
  removeAttachmentText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 11,
  },
  attachButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachButtonText: {
    color: '#0B6E4F',
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 120,
    backgroundColor: '#F8FAFC',
  },
  button: {
    backgroundColor: '#0B6E4F',
    borderRadius: 12,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
