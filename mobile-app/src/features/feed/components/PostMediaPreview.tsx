import React from 'react';
import { ActivityIndicator, Image, ImageStyle, Linking, Pressable, StyleProp, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { FeedPost } from '../../../shared/api/feed.api';
import { getMediaDownload } from '../../../shared/api/media.api';
import { radius, spacing, useAppColors } from '../../../shared/ui/design-tokens';

type PostMedia = FeedPost['media'][number];

export function PostMediaPreview({ media, imageStyle }: { media: PostMedia; imageStyle?: StyleProp<ImageStyle> }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const downloadQuery = useQuery({
    queryKey: ['media', 'download', media.mediaId],
    queryFn: () => getMediaDownload(media.mediaId as string),
    enabled: Boolean(media.mediaId),
    staleTime: 240_000,
  });
  const url = downloadQuery.data?.downloadUrl ?? media.url;

  if (!url) {
    return <View style={[styles.pending, { backgroundColor: colors.surfaceMuted }]}><ActivityIndicator color={colors.primary} accessibilityLabel={t('ui.states.loading')} /></View>;
  }

  if (media.type === 'image') {
    return <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="button" accessibilityLabel={t('ui.actions.open')}><Image source={{ uri: url }} style={[styles.image, imageStyle]} /></Pressable>;
  }

  return <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="button" accessibilityLabel={t('ui.actions.open')} style={[styles.video, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}><Text style={[styles.videoTitle, { color: colors.text }]}>{t('messages.bubble.video')}</Text><Text style={{ color: colors.primary }}>{t('ui.actions.open')}</Text></Pressable>;
}

const styles = StyleSheet.create({
  pending: { minHeight: 160, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  image: { width: 240, height: 180, borderRadius: radius.md },
  video: { minHeight: 96, borderRadius: radius.md, borderWidth: 1, padding: spacing.md, gap: spacing.xs, justifyContent: 'center' },
  videoTitle: { fontWeight: '700' },
});
