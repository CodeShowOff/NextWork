import React, { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { ComposerAttachment } from '../hooks/useSendMessage';
import { type AppColors, useAppColors } from '../../../shared/ui/design-tokens';

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

function inferDocumentContentType(fileName: string, mimeType?: string | null): ComposerAttachment['contentType'] | null {
  const allowed: ComposerAttachment['contentType'][] = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];
  if (mimeType && allowed.includes(mimeType as ComposerAttachment['contentType'])) return mimeType as ComposerAttachment['contentType'];
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  return null;
}

function nextAttachmentId() {
  return `composer-att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function MessageComposer({ isSending, onSend, onTypingChange }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

  const addAttachment = (attachment: ComposerAttachment) => {
    setAttachments((current) => [...current, attachment].slice(0, 5));
  };

  const pickMedia = async () => {
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
    addAttachment({
      id: nextAttachmentId(),
      localUri: asset.uri,
      fileName,
      contentType: inferImagePickerContentType(fileName, asset.mimeType),
      sizeBytes: asset.fileSize,
      width: asset.width,
      height: asset.height,
      durationMs: asset.duration ? Math.round(asset.duration) : undefined,
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
    const contentType = inferDocumentContentType(asset.name, asset.mimeType);
    if (!contentType) {
      Alert.alert(t('ui.states.errorTitle'), t('messages.composer.unsupportedDocument'));
      return;
    }
    addAttachment({ id: nextAttachmentId(), localUri: asset.uri, fileName: asset.name, contentType, sizeBytes: asset.size, status: 'pending' });
  };

  const pickAttachment = () => {
    Alert.alert(t('messages.composer.attach'), t('messages.composer.attachPrompt'), [
      { text: t('messages.composer.photoOrVideo'), onPress: () => void pickMedia() },
      { text: t('messages.composer.document'), onPress: () => void pickDocument() },
      { text: t('common.actions.cancel'), style: 'cancel' },
    ]);
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
              <Text style={styles.attachmentStatus}>{t(`messages.composer.status.${attachment.status}`)}</Text>
              {attachment.status === 'failed' ? (
                <Pressable
                  style={styles.retryAttachmentButton}
                  onPress={() => retryFailedAttachment(attachment.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('ui.actions.retry')}
                >
                  <Text style={styles.retryAttachmentButtonText}>{t('ui.actions.retry')}</Text>
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
      <View style={styles.inputRow}>
        <Pressable
          style={styles.attachButton}
          onPress={pickAttachment}
          accessibilityRole="button"
          accessibilityLabel={t('messages.composer.attach')}
        >
          <MaterialIcons name="attach-file" size={20} color={colors.primary} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={handleChangeText}
          placeholder={t('messages.composer.placeholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          accessibilityLabel={t('messages.composer.placeholder')}
        />
        <Pressable
          style={[styles.button, isSending ? styles.disabledButton : null]}
          onPress={submit}
          disabled={isSending}
          accessibilityRole="button"
          accessibilityLabel={t('messages.composer.send')}
        >
          <MaterialIcons name="send" size={18} color={colors.onPrimary} />
          <Text style={styles.buttonText}>{isSending ? t('messages.composer.sending') : t('messages.composer.send')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  root: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'column',
    gap: 10,
    backgroundColor: colors.surface,
  },
  attachmentsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachmentChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
    maxWidth: '100%',
    backgroundColor: colors.surfaceMuted,
  },
  attachmentName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 200,
  },
  attachmentStatus: {
    color: colors.textMuted,
    fontSize: 11,
  },
  retryAttachmentButton: {
    alignSelf: 'flex-start',
  },
  retryAttachmentButtonText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  removeAttachmentText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 11,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 120,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    minWidth: 92,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    height: 42,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
});
