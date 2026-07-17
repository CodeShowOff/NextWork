import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { addGroupAlbumPhoto, deleteGroupAlbumPhoto, getGroupAlbum, getGroupAlbumPhotoDownload } from '../../shared/api/group-collaboration.api';
import { getGroup } from '../../shared/api/groups.api';
import { getMediaStatus, uploadAttachmentWithContract } from '../../shared/api/media.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { AppButton, AppCard, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'AlbumDetail'>;

export function AlbumDetailScreen({ route }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { groupId, albumId } = route.params;
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pendingMediaId, setPendingMediaId] = useState<string | null>(null);
  const albumQuery = useQuery({ queryKey: ['groups', groupId, 'albums', albumId], queryFn: () => getGroupAlbum(groupId, albumId) });
  const groupQuery = useQuery({ queryKey: ['groups', 'detail', groupId], queryFn: () => getGroup(groupId) });
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  useEffect(() => {
    const photos = albumQuery.data?.photos ?? [];
    void Promise.all(photos.filter((photo) => photo.status === 'available' && !urls[photo.id]).map(async (photo) => {
      const download = await getGroupAlbumPhotoDownload(groupId, albumId, photo.id);
      return [photo.id, download.downloadUrl] as const;
    })).then((entries) => { if (entries.length) setUrls((current) => ({ ...current, ...Object.fromEntries(entries) })); }).catch(() => undefined);
  }, [albumId, albumQuery.data?.photos, groupId, urls]);
  const add = useMutation({
    mutationFn: (mediaId: string) => addGroupAlbumPhoto(groupId, albumId, { mediaId }),
    onSuccess: () => { setPendingMediaId(null); queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'albums', albumId] }); queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'albums'] }); },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const remove = useMutation({ mutationFn: (photoId: string) => deleteGroupAlbumPhoto(groupId, albumId, photoId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'albums', albumId] }), onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message) });
  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert(t('ui.states.errorTitle'), t('ui.groups.photoPermission')); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType === 'image/png' || asset.mimeType === 'image/webp' ? asset.mimeType : 'image/jpeg';
    try {
      const uploaded = await uploadAttachmentWithContract({ localUri: asset.uri, fileName: asset.fileName ?? `photo-${Date.now()}.jpg`, contentType, sizeBytes: asset.fileSize, groupId });
      if (uploaded.completion.status === 'available') { add.mutate(uploaded.mediaId); } else { setPendingMediaId(uploaded.mediaId); }
    } catch (error) { Alert.alert(t('ui.states.errorTitle'), (error as Error).message); }
  };
  const completePending = async () => {
    if (!pendingMediaId) return;
    const status = await getMediaStatus(pendingMediaId);
    if (status.status === 'available') add.mutate(pendingMediaId);
    else Alert.alert(t('ui.groups.scanning'), status.scanDetail ?? t('ui.states.errorBody'));
  };
  if (albumQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  if (!albumQuery.data) return <AppScreen><AppState kind="error" title={t('ui.states.errorTitle')} body={t('ui.states.errorBody')} /></AppScreen>;
  const album = albumQuery.data;
  return <AppScreen contentStyle={styles.fill}><ScrollView contentContainerStyle={styles.content}><Text style={[styles.title, { color: colors.text }]}>{album.title}</Text><AppButton label={t('ui.groups.addPhoto')} icon="add-a-photo" onPress={() => void choosePhoto()} />{pendingMediaId ? <AppCard><AppListRow title={t('ui.groups.scanning')} trailing={<AppButton label={t('ui.actions.refresh')} variant="secondary" onPress={() => void completePending()} />}/></AppCard> : null}{album.photos.map((photo) => <AppCard key={photo.id}>{urls[photo.id] ? <Image source={{ uri: urls[photo.id] }} style={styles.image} /> : <AppState kind="loading" title={t('ui.states.loading')} />}<AppListRow title={photo.fileName} subtitle={photo.uploadedBy.displayName} onPress={() => urls[photo.id] ? void Linking.openURL(urls[photo.id]) : undefined} />{(groupQuery.data?.canManage || photo.uploadedBy.id === meQuery.data?.id) ? <AppButton label={t('ui.actions.remove')} variant="danger" loading={remove.isPending} onPress={() => remove.mutate(photo.id)} /> : null}</AppCard>)}{!album.photos.length ? <AppState kind="empty" title={t('ui.groups.noPhotos')} /> : null}</ScrollView></AppScreen>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, content: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 }, title: { fontSize: 18, fontWeight: '800' }, image: { width: '100%', height: 260, borderRadius: 12 } });
