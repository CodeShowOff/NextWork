import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Calendar from 'expo-calendar';
import * as DocumentPicker from 'expo-document-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createPost, listFeed } from '../../shared/api/feed.api';
import {
  createGroupAlbum,
  createGroupEvent,
  createGroupFile,
  deleteGroupEvent,
  deleteGroupFile,
  endGroupLiveSession,
  exportGroupEventCalendar,
  getGroupFileDownload,
  getGroupLiveSession,
  joinGroupLiveSession,
  listGroupAlbums,
  listGroupEvents,
  listGroupFiles,
  setGroupEventRsvp,
  startGroupLiveSession,
  updateGroupEvent,
} from '../../shared/api/group-collaboration.api';
import { getGroup, joinGroup, recordGroupVisit, setGroupFavorite } from '../../shared/api/groups.api';
import { getMediaStatus, SupportedUploadContentType, uploadAttachmentWithContract } from '../../shared/api/media.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { AppAvatar, AppButton, AppCard, AppField, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupHub'>;
type HubTab = 'posts' | 'files' | 'albums' | 'events' | 'live';

const supportedMimeTypes: SupportedUploadContentType[] = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
];

function inferMimeType(name: string, value: string | null | undefined): SupportedUploadContentType | null {
  if (value && supportedMimeTypes.includes(value as SupportedUploadContentType)) return value as SupportedUploadContentType;
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}

export function GroupHubScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const groupId = route.params.groupId;
  const [tab, setTab] = useState<HubTab>('posts');
  const [postText, setPostText] = useState('');
  const [albumTitle, setAlbumTitle] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState(new Date(Date.now() + 3_600_000).toISOString());
  const [eventTimezone, setEventTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ mediaId: string; fileName: string } | null>(null);

  const groupQuery = useQuery({ queryKey: ['groups', 'detail', groupId], queryFn: () => getGroup(groupId) });
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const postsQuery = useQuery({ queryKey: ['feed', 'group', groupId], queryFn: () => listFeed({ limit: 30, groupId }), enabled: tab === 'posts' });
  const filesQuery = useQuery({ queryKey: ['groups', groupId, 'files'], queryFn: () => listGroupFiles(groupId), enabled: tab === 'files' });
  const albumsQuery = useQuery({ queryKey: ['groups', groupId, 'albums'], queryFn: () => listGroupAlbums(groupId), enabled: tab === 'albums' });
  const eventsQuery = useQuery({ queryKey: ['groups', groupId, 'events'], queryFn: () => listGroupEvents(groupId), enabled: tab === 'events' });
  const liveQuery = useQuery({ queryKey: ['groups', groupId, 'live'], queryFn: () => getGroupLiveSession(groupId), enabled: tab === 'live' });

  useEffect(() => {
    void recordGroupVisit(groupId).catch(() => undefined);
  }, [groupId]);

  const createPostMutation = useMutation({
    mutationFn: () => createPost({ content: postText.trim(), groupId }),
    onSuccess: () => {
      setPostText('');
      queryClient.invalidateQueries({ queryKey: ['feed', 'group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const favoriteMutation = useMutation({
    mutationFn: (isFavorite: boolean) => setGroupFavorite(groupId, isFavorite),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['groups'] }),
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const joinMutation = useMutation({
    mutationFn: () => joinGroup(groupId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', 'detail', groupId] });
      if (result.status === 'requested') {
        Alert.alert(t('ui.groups.requested'));
      }
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const createAlbumMutation = useMutation({
    mutationFn: () => createGroupAlbum(groupId, { title: albumTitle.trim() }),
    onSuccess: () => {
      setAlbumTitle('');
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'albums'] });
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const createEventMutation = useMutation({
    mutationFn: () => createGroupEvent(groupId, { title: eventTitle.trim(), startsAt: eventStartsAt.trim(), timezone: eventTimezone.trim() }),
    onSuccess: () => {
      resetEventForm();
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'events'] });
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const updateEventMutation = useMutation({
    mutationFn: (eventId: string) => updateGroupEvent(groupId, eventId, { title: eventTitle.trim(), startsAt: eventStartsAt.trim(), timezone: eventTimezone.trim() }),
    onSuccess: () => {
      resetEventForm();
      queryClient.invalidateQueries({ queryKey: ['groups', groupId, 'events'] });
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });

  const tabs = useMemo(() => [
    { key: 'posts' as const, label: t('ui.groups.posts') },
    { key: 'files' as const, label: t('ui.groups.files') },
    { key: 'albums' as const, label: t('ui.groups.albums') },
    { key: 'events' as const, label: t('ui.groups.events') },
    { key: 'live' as const, label: t('ui.groups.live') },
  ], [t]);

  const uploadFile = async () => {
    const selection = await DocumentPicker.getDocumentAsync({ type: supportedMimeTypes, copyToCacheDirectory: true });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    if (!asset) return;
    const contentType = inferMimeType(asset.name, asset.mimeType);
    if (!contentType) {
      Alert.alert(t('ui.states.errorTitle'), t('ui.states.errorBody'));
      return;
    }
    try {
      const uploaded = await uploadAttachmentWithContract({
        localUri: asset.uri,
        fileName: asset.name,
        contentType,
        sizeBytes: asset.size,
        groupId,
      });
      if (uploaded.completion.status === 'available') {
        await createGroupFile(groupId, { mediaId: uploaded.mediaId, title: asset.name });
        await filesQuery.refetch();
        return;
      }
      setPendingUpload({ mediaId: uploaded.mediaId, fileName: asset.name });
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };

  const completePendingUpload = async () => {
    if (!pendingUpload) return;
    try {
      const status = await getMediaStatus(pendingUpload.mediaId);
      if (status.status !== 'available') {
        Alert.alert(t('ui.groups.scanning'), status.scanDetail ?? t('ui.states.errorBody'));
        return;
      }
      await createGroupFile(groupId, { mediaId: pendingUpload.mediaId, title: pendingUpload.fileName });
      setPendingUpload(null);
      await filesQuery.refetch();
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };

  const openLiveRoom = async (host: boolean) => {
    try {
      const result = host ? await startGroupLiveSession(groupId) : await joinGroupLiveSession(groupId);
      const isHost = host && ('started' in result ? result.started : false);
      navigation.navigate('LiveRoom', { groupId, sessionId: result.id, serverUrl: result.serverUrl, token: result.token, host: isHost });
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventStartsAt(new Date(Date.now() + 3_600_000).toISOString());
    setEventTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  };

  const openGroupFile = async (fileId: string) => {
    try {
      const result = await getGroupFileDownload(groupId, fileId);
      await Linking.openURL(result.downloadUrl);
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };

  const removeGroupFile = async (fileId: string) => {
    try {
      await deleteGroupFile(groupId, fileId);
      await filesQuery.refetch();
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };

  const updateRsvp = async (eventId: string, status: 'going' | 'maybe' | 'declined') => {
    try {
      await setGroupEventRsvp(groupId, eventId, status);
      await eventsQuery.refetch();
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };

  const removeEvent = async (eventId: string) => {
    try {
      await deleteGroupEvent(groupId, eventId);
      await eventsQuery.refetch();
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };

  const endLiveRoom = async () => {
    try {
      await endGroupLiveSession(groupId);
      await liveQuery.refetch();
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };

  const formatDateTime = (value: string, timeZone?: string) => {
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
        ...(timeZone ? { timeZone } : {}),
      }).format(new Date(value));
    } catch {
      return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
    }
  };

  if (groupQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  if (groupQuery.isError || !groupQuery.data) return <AppScreen><AppState kind="error" title={t('ui.states.errorTitle')} body={t('ui.states.errorBody')} action={{ label: t('ui.actions.retry'), onPress: () => groupQuery.refetch() }} /></AppScreen>;

  const group = groupQuery.data;
  const joined = Boolean(group.membership);
  return (
    <AppScreen contentStyle={styles.fill}>
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <AppAvatar name={group.name} size={52} />
          <View style={styles.summaryCopy}>
            <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
            <Text style={[styles.groupMeta, { color: colors.textMuted }]}>{t('ui.groups.members', { count: group.memberCount })} | {t(`ui.groups.${group.groupPrivacy.toLowerCase()}`)}</Text>
          </View>
        </View>
        {group.description ? <Text style={[styles.description, { color: colors.textMuted }]}>{group.description}</Text> : null}
        <View style={styles.summaryActions}>
          {joined ? <AppButton label={group.membership?.isFavorite ? t('ui.actions.unfavorite') : t('ui.actions.favorite')} onPress={() => favoriteMutation.mutate(!group.membership?.isFavorite)} variant="secondary" /> : <AppButton label={group.groupPrivacy === 'Closed' ? t('ui.actions.requestToJoin') : t('ui.actions.join')} onPress={() => joinMutation.mutate()} loading={joinMutation.isPending} />}
        </View>
        {joined && group.canManage ? <View style={styles.manageActions}><AppButton label={t('ui.groups.membersTitle')} variant="secondary" onPress={() => navigation.navigate('GroupMembers', { groupId })} /><AppButton label={t('ui.groups.requests')} variant="secondary" onPress={() => navigation.navigate('GroupRequests', { groupId })} /><AppButton label={t('ui.groups.invites')} variant="secondary" onPress={() => navigation.navigate('GroupInvites', { groupId })} /><AppButton label={t('ui.groups.settings')} variant="secondary" onPress={() => navigation.navigate('GroupSettings', { groupId })} /></View> : null}
      </View>
      {joined ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {tabs.map((entry) => {
              const selected = entry.key === tab;
              return <Pressable key={entry.key} onPress={() => setTab(entry.key)} accessibilityRole="tab" accessibilityState={{ selected }} style={[styles.tab, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceMuted : colors.surface }]}><Text style={{ color: selected ? colors.primary : colors.text, fontWeight: '700' }}>{entry.label}</Text></Pressable>;
            })}
          </ScrollView>
          <View style={styles.tabContent}>{renderTab()}</View>
        </>
      ) : null}
    </AppScreen>
  );

  function renderTab() {
    if (tab === 'posts') {
      if (postsQuery.isLoading) return <AppState kind="loading" title={t('ui.states.loading')} />;
      return <ScrollView contentContainerStyle={styles.panel}>
        <AppCard>
          <AppField value={postText} onChangeText={setPostText} placeholder={t('ui.fields.update')} multiline accessibilityLabel={t('ui.fields.update')} />
          <AppButton label={t('feed.composer.post')} onPress={() => createPostMutation.mutate()} loading={createPostMutation.isPending} disabled={!postText.trim()} />
        </AppCard>
        {(postsQuery.data?.items ?? []).map((post) => <AppCard key={post.id}><AppListRow title={post.author.displayName} subtitle={post.content} leading={<AppAvatar name={post.author.displayName} />} trailing={<Text style={{ color: colors.textMuted }}>{post.stats.likeCount}</Text>} /></AppCard>)}
        {(postsQuery.data?.items ?? []).length === 0 ? <AppState kind="empty" title={t('ui.states.emptyFeed')} /> : null}
      </ScrollView>;
    }
    if (tab === 'files') {
      if (filesQuery.isLoading) return <AppState kind="loading" title={t('ui.states.loading')} />;
      return <ScrollView contentContainerStyle={styles.panel}>
        <AppButton label={t('ui.groups.addFile')} icon="upload-file" onPress={uploadFile} />
        {pendingUpload ? <AppCard><AppListRow title={pendingUpload.fileName} subtitle={t('ui.groups.scanning')} leading={<AppAvatar name={pendingUpload.fileName} />} trailing={<AppButton label={t('ui.actions.refresh')} variant="secondary" onPress={completePendingUpload} />}/></AppCard> : null}
        {(filesQuery.data?.items ?? []).map((file) => <AppCard key={file.id}><AppListRow title={file.title ?? file.fileName} subtitle={`${file.contentType} | ${file.uploadedBy.displayName}`} leading={<AppAvatar name={file.fileName} />} trailing={<AppButton label={t('ui.actions.download')} variant="secondary" onPress={() => void openGroupFile(file.id)} />}/>{(group.canManage || file.uploadedBy.id === meQuery.data?.id) ? <AppButton label={t('ui.actions.remove')} variant="danger" onPress={() => void removeGroupFile(file.id)} /> : null}</AppCard>)}
        {(filesQuery.data?.items ?? []).length === 0 ? <AppState kind="empty" title={t('ui.groups.noFiles')} /> : null}
      </ScrollView>;
    }
    if (tab === 'albums') {
      if (albumsQuery.isLoading) return <AppState kind="loading" title={t('ui.states.loading')} />;
      return <ScrollView contentContainerStyle={styles.panel}>
        <AppCard><AppField value={albumTitle} onChangeText={setAlbumTitle} placeholder={t('ui.fields.albumTitle')} accessibilityLabel={t('ui.fields.albumTitle')} /><AppButton label={t('ui.groups.createAlbum')} onPress={() => createAlbumMutation.mutate()} loading={createAlbumMutation.isPending} disabled={!albumTitle.trim()} /></AppCard>
        {(albumsQuery.data?.items ?? []).map((album) => <AppCard key={album.id}><AppListRow title={album.title} subtitle={t('ui.groups.photos', { count: album.photoCount })} leading={<AppAvatar name={album.title} />} onPress={() => navigation.navigate('AlbumDetail', { groupId, albumId: album.id })}/></AppCard>)}
        {(albumsQuery.data?.items ?? []).length === 0 ? <AppState kind="empty" title={t('ui.groups.noAlbums')} /> : null}
      </ScrollView>;
    }
    if (tab === 'events') {
      if (eventsQuery.isLoading) return <AppState kind="loading" title={t('ui.states.loading')} />;
      return <ScrollView contentContainerStyle={styles.panel}>
        <AppCard><AppField value={eventTitle} onChangeText={setEventTitle} placeholder={t('ui.fields.eventTitle')} accessibilityLabel={t('ui.fields.eventTitle')} /><AppField value={eventStartsAt} onChangeText={setEventStartsAt} placeholder={t('ui.fields.eventStartsAt')} accessibilityLabel={t('ui.fields.eventStartsAt')} autoCapitalize="none" /><AppField value={eventTimezone} onChangeText={setEventTimezone} placeholder={t('ui.fields.eventTimezone')} accessibilityLabel={t('ui.fields.eventTimezone')} autoCapitalize="none" /><AppButton label={editingEventId ? t('ui.actions.save') : t('ui.groups.createEvent')} onPress={() => editingEventId ? updateEventMutation.mutate(editingEventId) : createEventMutation.mutate()} loading={createEventMutation.isPending || updateEventMutation.isPending} disabled={!eventTitle.trim()} />{editingEventId ? <AppButton label={t('ui.actions.cancel')} variant="ghost" onPress={resetEventForm} /> : null}</AppCard>
        {(eventsQuery.data?.items ?? []).map((event) => <AppCard key={event.id}><Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text><Text style={{ color: colors.textMuted }}>{formatDateTime(event.startsAt, event.timezone)} | {event.timezone}</Text><Text style={{ color: colors.textMuted }}>{t('ui.groups.attendeeCounts', event.attendeeCounts)}</Text><View style={styles.rsvpRow}>{(['going', 'maybe', 'declined'] as const).map((status) => <AppButton key={status} label={t(`ui.groups.${status === 'declined' ? 'decline' : status}`)} variant={event.rsvp === status ? 'primary' : 'secondary'} onPress={() => void updateRsvp(event.id, status)} />)}</View><AppButton label={t('ui.groups.exportCalendar')} variant="ghost" onPress={() => exportCalendar(event)} />{(group.canManage || event.createdBy.id === meQuery.data?.id) ? <><AppButton label={t('ui.actions.edit')} variant="secondary" onPress={() => { setEditingEventId(event.id); setEventTitle(event.title); setEventStartsAt(event.startsAt); setEventTimezone(event.timezone); }} /><AppButton label={t('ui.actions.delete')} variant="danger" onPress={() => void removeEvent(event.id)} /></> : null}</AppCard>)}
        {(eventsQuery.data?.items ?? []).length === 0 ? <AppState kind="empty" title={t('ui.groups.noEvents')} /> : null}
      </ScrollView>;
    }
    if (liveQuery.isLoading) return <AppState kind="loading" title={t('ui.states.loading')} />;
    const session = liveQuery.data?.session;
    return <ScrollView contentContainerStyle={styles.panel}><AppCard><Text style={[styles.eventTitle, { color: colors.text }]}>{session ? t('ui.groups.live') : t('ui.groups.noLive')}</Text>{session ? <><Text style={{ color: colors.textMuted }}>{formatDateTime(session.startedAt)}</Text><AppButton label={t('ui.groups.joinLive')} onPress={() => openLiveRoom(false)} />{group.canManage || session.startedById === meQuery.data?.id ? <AppButton label={t('ui.groups.endLive')} variant="danger" onPress={() => void endLiveRoom()} /> : null}</> : <AppButton label={t('ui.groups.startLive')} onPress={() => openLiveRoom(true)} />}</AppCard></ScrollView>;
  }

  async function exportCalendar(event: { id: string; title: string; startsAt: string; endsAt: string | null; timezone: string; description: string | null; location: string | null }) {
    try {
      await exportGroupEventCalendar(groupId, event.id);
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (permission.status !== 'granted') return;
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const calendar = calendars.find((candidate) => candidate.allowsModifications);
      if (!calendar) return;
      await Calendar.createEventAsync(calendar.id, { title: event.title, startDate: new Date(event.startsAt), endDate: event.endsAt ? new Date(event.endsAt) : new Date(event.startsAt), timeZone: event.timezone, notes: event.description ?? undefined, location: event.location ?? undefined });
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  }
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  summary: { padding: spacing.md, gap: spacing.sm },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  summaryCopy: { flex: 1, gap: 3 },
  groupName: { fontSize: 20, fontWeight: '800' },
  groupMeta: { fontSize: 13 },
  description: { lineHeight: 20 },
  summaryActions: { alignSelf: 'flex-start' },
  manageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tabRow: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.xs },
  tab: { minHeight: 38, paddingHorizontal: spacing.sm, borderWidth: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tabContent: { flex: 1 },
  panel: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  rsvpRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  eventTitle: { fontSize: 16, fontWeight: '700' },
});
