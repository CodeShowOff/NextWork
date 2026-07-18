import React, { useMemo, useState } from 'react';
import { FlatList, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Calendar from 'expo-calendar';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { FeedPost, createPost, listFeed } from '../shared/api/feed.api';
import {
  GroupAlbum,
  GroupEvent,
  GroupFile,
  addGroupAlbumPhoto,
  createGroupAlbum,
  createGroupEvent,
  createGroupFile,
  deleteGroupEvent,
  deleteGroupFile,
  endGroupLiveSession,
  exportGroupEventCalendar,
  getGroupAlbum,
  getGroupFileDownload,
  getGroupLiveSession,
  joinGroupLiveSession,
  listGroupAlbums,
  listGroupEvents,
  listGroupFiles,
  setGroupEventRsvp,
  startGroupLiveSession,
} from '../shared/api/group-collaboration.api';
import {
  Group,
  createGroup,
  createGroupInvitation,
  getGroup,
  joinGroup,
  listGroupMembers,
  listGroupMembershipRequests,
  listGroups,
  listMyGroupInvitations,
  recordGroupVisit,
  resolveGroupMembershipRequest,
  respondGroupInvitation,
  setGroupFavorite,
  updateGroup,
  updateGroupMemberRole,
} from '../shared/api/groups.api';
import { uploadAttachmentWithContract } from '../shared/api/media.api';
import { listMyOrganizations } from '../shared/api/organizations.api';
import { searchAll } from '../shared/api/search.api';
import { getCurrentUser } from '../shared/api/users.api';
import { radius, spacing, typography, useAppColors } from '../shared/ui/design-tokens';
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FeedSkeleton,
  IconButton,
  ListRow,
  ModalSheet,
  SectionHeader,
  SegmentedControl,
  TextField,
} from '../presentation/components';
import { useToast } from '../presentation/feedback';
import { Page, useAdaptiveLayout } from '../presentation/layout';
import { OfflineBanner, useNetwork } from '../presentation/resilience';
import { PostCard } from './HomeExperience';
import { RootStackParamList } from './navigation';

type GroupsProps = NativeStackScreenProps<RootStackParamList, 'Main'>;
type HubProps = NativeStackScreenProps<RootStackParamList, 'GroupHub'>;
type MembersProps = NativeStackScreenProps<RootStackParamList, 'GroupMembers'>;
type SettingsProps = NativeStackScreenProps<RootStackParamList, 'GroupSettings'>;
type HubTab = 'posts' | 'files' | 'albums' | 'events' | 'live' | 'about';

const supportedContentTypes = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
] as const;

function useGroupOrganization() {
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: listMyOrganizations,
  });
  const organizationId =
    meQuery.data?.activeOrganizationId ?? organizationsQuery.data?.items[0]?.organizationId;
  return { meQuery, organizationsQuery, organizationId };
}

export function GroupsExperience({ navigation }: GroupsProps) {
  const colors = useAppColors();
  const layout = useAdaptiveLayout();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { organizationId } = useGroupOrganization();
  const groupsQuery = useQuery({
    queryKey: ['groups', organizationId],
    queryFn: () => listGroups(organizationId as string),
    enabled: Boolean(organizationId),
  });
  const invitationsQuery = useQuery({
    queryKey: ['groups', 'invitations', 'mine'],
    queryFn: listMyGroupInvitations,
  });
  const [filter, setFilter] = useState<'all' | 'favorites' | 'recent'>('all');
  const [createVisible, setCreateVisible] = useState(false);
  const invitations = invitationsQuery.data?.items ?? [];
  const groups = useMemo(() => {
    const source = groupsQuery.data?.items ?? [];
    if (filter === 'favorites') return source.filter((group) => group.membership?.isFavorite);
    if (filter === 'recent')
      return [...source]
        .filter((group) => group.membership?.lastVisitedAt)
        .sort((a, b) =>
          String(b.membership?.lastVisitedAt).localeCompare(String(a.membership?.lastVisitedAt)),
        );
    return source;
  }, [filter, groupsQuery.data?.items]);
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      respondGroupInvitation(id, accept),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      showToast({ tone: 'success', message: 'Group invitation updated.' });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not update invitation.' }),
  });

  return (
    <Page edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.directory,
          layout.isCompact ? null : { alignSelf: 'center', width: '100%', maxWidth: 860 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshing={groupsQuery.isRefetching}
        onRefresh={() => void groupsQuery.refetch()}
        ListHeaderComponent={
          <View style={styles.directoryHeader}>
            <View style={styles.simpleTopBar}>
              <View>
                <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>
                  Groups
                </Text>
                <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
                  Where your work communities live.
                </Text>
              </View>
              <Button label="Create" icon="add" onPress={() => setCreateVisible(true)} />
            </View>
            <OfflineBanner />
            {invitations.map((invite) => (
              <Card
                key={invite.id}
                style={[styles.invitation, { backgroundColor: colors.surfaceTint }]}
              >
                <ListRow
                  title={invite.group.name}
                  subtitle={`${invite.invitedBy.displayName} invited you to join`}
                  leading={<Avatar name={invite.group.name} size={42} />}
                />
                <View style={styles.actionPair}>
                  <Button
                    label="Join"
                    onPress={() => respond.mutate({ id: invite.id, accept: true })}
                    loading={respond.isPending}
                  />
                  <Button
                    label="Decline"
                    variant="secondary"
                    onPress={() => respond.mutate({ id: invite.id, accept: false })}
                    disabled={respond.isPending}
                  />
                </View>
              </Card>
            ))}
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All groups' },
                { value: 'favorites', label: 'Favorites' },
                { value: 'recent', label: 'Recent' },
              ]}
            />
            <Text style={[styles.directoryCount, { color: colors.textMuted }]}>
              {groups.length} {groups.length === 1 ? 'group' : 'groups'} to explore
            </Text>
          </View>
        }
        ListEmptyComponent={
          groupsQuery.isLoading ? (
            <FeedSkeleton count={3} />
          ) : groupsQuery.isError ? (
            <ErrorState onRetry={() => void groupsQuery.refetch()} />
          ) : (
            <EmptyState
              title={filter === 'favorites' ? 'No favorite groups yet' : 'No groups yet'}
              body="Create a group or accept an invitation to get started."
              action={{ label: 'Create group', onPress: () => setCreateVisible(true) }}
            />
          )
        }
        renderItem={({ item }) => (
          <GroupCard
            group={item}
            onPress={() => navigation.navigate('GroupHub', { groupId: item.id })}
          />
        )}
        ListFooterComponent={<View style={{ height: spacing.xxl }} />}
      />
      {organizationId ? (
        <CreateGroupSheet
          visible={createVisible}
          organizationId={organizationId}
          onClose={() => setCreateVisible(false)}
          onCreated={(group) => {
            setCreateVisible(false);
            void queryClient.invalidateQueries({ queryKey: ['groups'] });
            navigation.navigate('GroupHub', { groupId: group.id });
          }}
        />
      ) : null}
    </Page>
  );
}

function GroupCard({ group, onPress }: { group: Group; onPress: () => void }) {
  const colors = useAppColors();
  return (
    <Card raised style={styles.groupCard}>
      <ListRow
        title={group.name}
        subtitle={group.description || `${group.memberCount} members · ${group.groupPrivacy}`}
        leading={<Avatar name={group.name} uri={group.photoUrl} size={52} />}
        onPress={onPress}
        trailing={
          <View style={[styles.privacyPill, { backgroundColor: colors.primarySoft }]}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>
              {group.groupPrivacy}
            </Text>
          </View>
        }
      />
      <View style={styles.groupMeta}>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{group.memberCount} members</Text>
        {group.membership?.isFavorite ? <Chip label="Favorite" selected icon="star" /> : null}
      </View>
    </Card>
  );
}

function CreateGroupSheet({
  visible,
  onClose,
  onCreated,
  organizationId,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
  organizationId: string;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'Open' | 'Closed' | 'Secret'>('Open');
  const mutation = useMutation({
    mutationFn: () =>
      createGroup({
        organizationId,
        name: name.trim(),
        description: description.trim() || undefined,
        groupPrivacy: privacy,
        groupType: 'team',
      }),
    onSuccess: (group) => {
      setName('');
      setDescription('');
      onCreated(group);
    },
    onError: (error) =>
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not create group.',
      }),
  });
  return (
    <ModalSheet
      visible={visible}
      title="Create a group"
      onClose={onClose}
      footer={
        <Button
          fullWidth
          label="Create group"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!name.trim()}
        />
      }
    >
      <TextField label="Group name" value={name} onChangeText={setName} autoFocus={visible} />
      <TextField
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="What is this space for?"
      />
      <SectionHeader title="Privacy" />
      <View style={styles.privacyOptions}>
        {(['Open', 'Closed', 'Secret'] as const).map((value) => (
          <Chip
            key={value}
            label={value}
            selected={privacy === value}
            onPress={() => setPrivacy(value)}
          />
        ))}
      </View>
    </ModalSheet>
  );
}

export function GroupHubExperience({ route, navigation }: HubProps) {
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isOnline } = useNetwork();
  const { meQuery } = useGroupOrganization();
  const groupId = route.params.groupId;
  const [tab, setTab] = useState<HubTab>('posts');
  const groupQuery = useQuery({
    queryKey: ['groups', 'detail', groupId],
    queryFn: () => getGroup(groupId),
  });
  const feedQuery = useQuery({
    queryKey: ['feed', 'group', groupId],
    queryFn: () => listFeed({ limit: 30, groupId }),
    enabled: tab === 'posts',
  });
  const filesQuery = useQuery({
    queryKey: ['groups', groupId, 'files'],
    queryFn: () => listGroupFiles(groupId),
    enabled: tab === 'files',
  });
  const albumsQuery = useQuery({
    queryKey: ['groups', groupId, 'albums'],
    queryFn: () => listGroupAlbums(groupId),
    enabled: tab === 'albums',
  });
  const eventsQuery = useQuery({
    queryKey: ['groups', groupId, 'events'],
    queryFn: () => listGroupEvents(groupId),
    enabled: tab === 'events',
  });
  const liveQuery = useQuery({
    queryKey: ['groups', groupId, 'live'],
    queryFn: () => getGroupLiveSession(groupId),
    enabled: tab === 'live',
  });
  const [postText, setPostText] = useState('');
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);

  React.useEffect(() => {
    void recordGroupVisit(groupId).catch(() => undefined);
  }, [groupId]);
  const favorite = useMutation({
    mutationFn: (isFavorite: boolean) => setGroupFavorite(groupId, isFavorite),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['groups'] }),
    onError: () => showToast({ tone: 'error', message: 'Could not update your favorite groups.' }),
  });
  const join = useMutation({
    mutationFn: () => joinGroup(groupId),
    onSuccess: (result) => {
      void groupQuery.refetch();
      showToast({
        tone: 'success',
        message:
          result.status === 'joined' ? 'You joined this group.' : 'Your request to join was sent.',
      });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not join this group.' }),
  });
  const post = useMutation({
    mutationFn: () => createPost({ content: postText.trim(), groupId }),
    onSuccess: () => {
      setPostText('');
      void feedQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not post to this group.' }),
  });

  if (groupQuery.isLoading)
    return (
      <Page>
        <FeedSkeleton count={2} />
      </Page>
    );
  if (!groupQuery.data)
    return (
      <Page>
        <ErrorState onRetry={() => void groupQuery.refetch()} />
      </Page>
    );
  const group = groupQuery.data;
  const tabs: Array<{ value: HubTab; label: string }> = [
    { value: 'posts', label: 'Posts' },
    { value: 'files', label: 'Files' },
    { value: 'albums', label: 'Albums' },
    { value: 'events', label: 'Events' },
    { value: 'live', label: 'Live' },
    { value: 'about', label: 'About' },
  ];

  return (
    <Page keyboardAware={false} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={[tab]}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.hubContent}
        ListHeaderComponent={
          <View style={styles.hubHeader}>
            <View style={[styles.hubHero, { backgroundColor: colors.primary }]}>
              <IconButton icon="arrow-back" label="Back" onPress={() => navigation.goBack()} />
              <View style={styles.hubHeroCopy}>
                <Avatar name={group.name} uri={group.photoUrl} size={58} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={styles.hubName}>
                    {group.name}
                  </Text>
                  <Text style={styles.hubMeta}>
                    {group.memberCount} members · {group.groupPrivacy}
                  </Text>
                </View>
              </View>
              <View style={styles.hubHeroActions}>
                {group.membership ? (
                  <Button
                    label={group.membership.isFavorite ? 'Favorited' : 'Favorite'}
                    variant="accent"
                    onPress={() => favorite.mutate(!group.membership?.isFavorite)}
                    loading={favorite.isPending}
                  />
                ) : (
                  <Button
                    label="Join group"
                    variant="accent"
                    onPress={() => join.mutate()}
                    loading={join.isPending}
                  />
                )}
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hubTabs}
            >
              {tabs.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  selected={item.value === tab}
                  onPress={() => setTab(item.value)}
                />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={() => (
          <View style={styles.hubPanel}>
            {tab === 'posts' ? (
              <GroupPosts
                posts={feedQuery.data?.items ?? []}
                postText={postText}
                setPostText={setPostText}
                posting={post.isPending}
                canPost={Boolean(group.membership) && isOnline}
                onPost={() => post.mutate()}
                onOpenPost={(postItem) => navigation.navigate('PostDetail', { post: postItem })}
                onOpenProfile={(userId) => navigation.navigate('Profile', { userId })}
                currentUserId={meQuery.data?.id}
              />
            ) : null}
            {tab === 'files' ? (
              <FilesPanel
                groupId={groupId}
                files={filesQuery.data?.items ?? []}
                isLoading={filesQuery.isLoading}
                canManage={Boolean(group.canManage)}
                onChanged={() => void filesQuery.refetch()}
              />
            ) : null}
            {tab === 'albums' ? (
              <AlbumsPanel
                groupId={groupId}
                albums={albumsQuery.data?.items ?? []}
                isLoading={albumsQuery.isLoading}
                canManage={Boolean(group.canManage)}
                onCreate={() => setCreateAlbumOpen(true)}
              />
            ) : null}
            {tab === 'events' ? (
              <EventsPanel
                groupId={groupId}
                events={eventsQuery.data?.items ?? []}
                isLoading={eventsQuery.isLoading}
                canManage={Boolean(group.canManage)}
                onCreate={() => setCreateEventOpen(true)}
                onChanged={() => void eventsQuery.refetch()}
              />
            ) : null}
            {tab === 'live' ? (
              <LivePanel
                groupId={groupId}
                session={liveQuery.data?.session ?? null}
                canManage={Boolean(group.canManage)}
                onJoin={(session) =>
                  navigation.navigate('LiveRoom', {
                    groupId,
                    sessionId: session.id,
                    serverUrl: session.serverUrl,
                    token: session.token,
                    host: Boolean(group.canManage),
                  })
                }
                onChanged={() => void liveQuery.refetch()}
              />
            ) : null}
            {tab === 'about' ? (
              <AboutPanel
                group={group}
                onMembers={() => navigation.navigate('GroupMembers', { groupId })}
                onSettings={() => navigation.navigate('GroupSettings', { groupId })}
              />
            ) : null}
          </View>
        )}
      />
      <CreateAlbumSheet
        visible={createAlbumOpen}
        groupId={groupId}
        onClose={() => setCreateAlbumOpen(false)}
        onCreated={() => {
          setCreateAlbumOpen(false);
          void albumsQuery.refetch();
        }}
      />
      <CreateEventSheet
        visible={createEventOpen}
        groupId={groupId}
        onClose={() => setCreateEventOpen(false)}
        onCreated={() => {
          setCreateEventOpen(false);
          void eventsQuery.refetch();
        }}
      />
    </Page>
  );
}

function GroupPosts({
  posts,
  postText,
  setPostText,
  posting,
  canPost,
  onPost,
  onOpenPost,
  onOpenProfile,
  currentUserId,
}: {
  posts: FeedPost[];
  postText: string;
  setPostText: (value: string) => void;
  posting: boolean;
  canPost: boolean;
  onPost: () => void;
  onOpenPost: (post: FeedPost) => void;
  onOpenProfile: (id: string) => void;
  currentUserId?: string;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <TextField
          value={postText}
          onChangeText={setPostText}
          multiline
          placeholder={
            canPost ? 'Share an update with this group' : 'Join this group to share an update'
          }
          editable={canPost}
        />
        <Button
          label="Post to group"
          icon="send"
          onPress={onPost}
          loading={posting}
          disabled={!canPost || !postText.trim()}
        />
      </Card>
      {posts.length ? (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onOpen={() => onOpenPost(post)}
            onOpenProfile={onOpenProfile}
            compact
          />
        ))
      ) : (
        <EmptyState
          title="No group posts yet"
          body="Start the conversation with an update for this group."
          icon="forum"
        />
      )}
    </View>
  );
}

function FilesPanel({
  groupId,
  files,
  isLoading,
  canManage,
  onChanged,
}: {
  groupId: string;
  files: GroupFile[];
  isLoading: boolean;
  canManage: boolean;
  onChanged: () => void;
}) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => deleteGroupFile(groupId, fileId),
    onSuccess: onChanged,
    onError: () => showToast({ tone: 'error', message: 'Could not remove file.' }),
  });
  const upload = async () => {
    try {
      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [...supportedContentTypes],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const contentType = supportedContentTypes.includes(asset.mimeType as any)
        ? (asset.mimeType as (typeof supportedContentTypes)[number])
        : 'application/pdf';
      const uploaded = await uploadAttachmentWithContract({
        localUri: asset.uri,
        fileName: asset.name,
        contentType,
        sizeBytes: asset.size,
        groupId,
      });
      await createGroupFile(groupId, { mediaId: uploaded.mediaId, title: asset.name });
      showToast({
        tone: 'success',
        message: 'File uploaded. It may take a moment to become available.',
      });
      onChanged();
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not upload file.',
      });
    } finally {
      setUploading(false);
    }
  };
  const open = async (file: GroupFile) => {
    try {
      const response = await getGroupFileDownload(groupId, file.id);
      await Linking.openURL(response.downloadUrl);
    } catch {
      showToast({ tone: 'error', message: 'Could not open that file.' });
    }
  };
  if (isLoading) return <FeedSkeleton count={2} />;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.sectionAction}>
        <SectionHeader title="Shared files" />
        <Button
          label="Upload file"
          icon="upload-file"
          onPress={() => void upload()}
          loading={uploading}
        />
      </View>
      {files.length ? (
        files.map((file) => (
          <Card key={file.id}>
            <ListRow
              title={file.title || file.fileName}
              subtitle={`${file.uploadedBy.displayName} · ${new Date(file.createdAt).toLocaleDateString()}`}
              leading={
                <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '900' }}>
                    {file.fileName.split('.').pop()?.toUpperCase() || 'FILE'}
                  </Text>
                </View>
              }
              onPress={() => void open(file)}
              trailing={
                canManage ? (
                  <IconButton
                    icon="delete-outline"
                    label="Delete file"
                    onPress={() => deleteMutation.mutate(file.id)}
                  />
                ) : undefined
              }
            />
          </Card>
        ))
      ) : (
        <EmptyState
          title="No files yet"
          body="Documents and media shared with the group will appear here."
          icon="folder-open"
        />
      )}
    </View>
  );
}

function AlbumsPanel({
  groupId,
  albums,
  isLoading,
  canManage,
  onCreate,
}: {
  groupId: string;
  albums: GroupAlbum[];
  isLoading: boolean;
  canManage: boolean;
  onCreate: () => void;
}) {
  const [selected, setSelected] = useState<GroupAlbum | null>(null);
  if (isLoading) return <FeedSkeleton count={2} />;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.sectionAction}>
        <SectionHeader title="Photo albums" />
        <Button label="Create album" icon="photo-album" onPress={onCreate} disabled={!canManage} />
      </View>
      {albums.length ? (
        albums.map((album) => (
          <Card key={album.id}>
            <ListRow
              title={album.title}
              subtitle={`${album.photoCount} ${album.photoCount === 1 ? 'photo' : 'photos'}`}
              leading={<Avatar name={album.title} size={46} />}
              onPress={() => setSelected(album)}
            />
          </Card>
        ))
      ) : (
        <EmptyState
          title="No albums yet"
          body="Create an album to collect a group moment or project update."
          icon="photo-library"
        />
      )}
      <AlbumDetailSheet groupId={groupId} album={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function AlbumDetailSheet({
  groupId,
  album,
  onClose,
}: {
  groupId: string;
  album: GroupAlbum | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const detailQuery = useQuery({
    queryKey: ['groups', groupId, 'albums', album?.id],
    queryFn: () => getGroupAlbum(groupId, album!.id),
    enabled: Boolean(album),
  });
  const [uploading, setUploading] = useState(false);
  const addPhoto = async () => {
    if (!album) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ tone: 'error', message: 'Photo library access is required to add photos.' });
      return;
    }
    try {
      setUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const contentType =
        asset.mimeType === 'image/png' || asset.mimeType === 'image/webp'
          ? asset.mimeType
          : 'image/jpeg';
      const uploaded = await uploadAttachmentWithContract({
        localUri: asset.uri,
        fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
        contentType,
        sizeBytes: asset.fileSize,
        groupId,
      });
      await addGroupAlbumPhoto(groupId, album.id, { mediaId: uploaded.mediaId });
      void detailQuery.refetch();
      showToast({ tone: 'success', message: 'Photo added to the album.' });
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not add photo.',
      });
    } finally {
      setUploading(false);
    }
  };
  return (
    <ModalSheet
      visible={Boolean(album)}
      title={album?.title ?? 'Album'}
      onClose={onClose}
      footer={
        <Button
          fullWidth
          label="Add photo"
          icon="add-a-photo"
          onPress={() => void addPhoto()}
          loading={uploading}
        />
      }
    >
      {detailQuery.isLoading ? (
        <FeedSkeleton count={1} />
      ) : detailQuery.data?.photos.length ? (
        <View style={{ gap: spacing.sm }}>
          {detailQuery.data.photos.map((photo) => (
            <Card key={photo.id} style={{ padding: spacing.sm }}>
              <ListRow
                title={photo.fileName}
                subtitle={photo.uploadedBy.displayName}
                leading={<Avatar name={photo.fileName} size={36} />}
              />
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No photos in this album"
          body="Add a photo from your device to get started."
          icon="image"
        />
      )}
    </ModalSheet>
  );
}

function EventsPanel({
  groupId,
  events,
  isLoading,
  canManage,
  onCreate,
  onChanged,
}: {
  groupId: string;
  events: GroupEvent[];
  isLoading: boolean;
  canManage: boolean;
  onCreate: () => void;
  onChanged: () => void;
}) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const rsvp = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'going' | 'maybe' | 'declined' }) =>
      setGroupEventRsvp(groupId, id, status),
    onSuccess: onChanged,
    onError: () => showToast({ tone: 'error', message: 'Could not update RSVP.' }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteGroupEvent(groupId, id),
    onSuccess: onChanged,
    onError: () => showToast({ tone: 'error', message: 'Could not delete event.' }),
  });
  const exportCalendar = async (event: GroupEvent) => {
    try {
      await exportGroupEventCalendar(groupId, event.id);
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (permission.granted) {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const target = calendars.find((calendar) => calendar.allowsModifications);
        if (target) {
          await Calendar.createEventAsync(target.id, {
            title: event.title,
            notes: event.description ?? undefined,
            location: event.location ?? undefined,
            startDate: new Date(event.startsAt),
            endDate: new Date(event.endsAt ?? event.startsAt),
            timeZone: event.timezone,
          });
          showToast({ tone: 'success', message: 'Event added to your calendar.' });
          return;
        }
      }
      showToast({
        tone: 'info',
        message:
          'Calendar file prepared. Use the event details to add it to your preferred calendar.',
      });
    } catch {
      showToast({ tone: 'error', message: 'Could not export event.' });
    }
  };
  if (isLoading) return <FeedSkeleton count={2} />;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.sectionAction}>
        <SectionHeader title="Events" />
        <Button label="Create event" icon="event" onPress={onCreate} disabled={!canManage} />
      </View>
      {events.length ? (
        events.map((event) => (
          <Card key={event.id}>
            <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
            <Text style={{ color: colors.textMuted }}>
              {new Date(event.startsAt).toLocaleString()} · {event.timezone}
            </Text>
            {event.location ? (
              <Text style={{ color: colors.textMuted }}>{event.location}</Text>
            ) : null}
            <View style={styles.actionWrap}>
              <Button
                label="Going"
                variant={event.rsvp === 'going' ? 'primary' : 'secondary'}
                onPress={() => rsvp.mutate({ id: event.id, status: 'going' })}
              />
              <Button
                label="Maybe"
                variant={event.rsvp === 'maybe' ? 'primary' : 'secondary'}
                onPress={() => rsvp.mutate({ id: event.id, status: 'maybe' })}
              />
              <Button
                label="Calendar"
                variant="ghost"
                icon="calendar-today"
                onPress={() => void exportCalendar(event)}
              />
              {canManage ? (
                <IconButton
                  icon="delete-outline"
                  label="Delete event"
                  onPress={() => remove.mutate(event.id)}
                />
              ) : null}
            </View>
          </Card>
        ))
      ) : (
        <EmptyState
          title="No upcoming events"
          body="Plan a meeting, offsite, or shared moment for this group."
          icon="event"
        />
      )}
    </View>
  );
}

function LivePanel({
  groupId,
  session,
  canManage,
  onJoin,
  onChanged,
}: {
  groupId: string;
  session: any;
  canManage: boolean;
  onJoin: (session: any) => void;
  onChanged: () => void;
}) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const start = useMutation({
    mutationFn: () => startGroupLiveSession(groupId),
    onSuccess: (created) => {
      onChanged();
      onJoin(created);
    },
    onError: () => showToast({ tone: 'error', message: 'Could not start live room.' }),
  });
  const join = useMutation({
    mutationFn: () => joinGroupLiveSession(groupId),
    onSuccess: onJoin,
    onError: () => showToast({ tone: 'error', message: 'Could not join live room.' }),
  });
  const end = useMutation({
    mutationFn: () => endGroupLiveSession(groupId),
    onSuccess: onChanged,
    onError: () => showToast({ tone: 'error', message: 'Could not end live room.' }),
  });
  return (
    <View style={{ gap: spacing.md }}>
      <Card raised style={[styles.liveCard, { backgroundColor: colors.surfaceTint }]}>
        <View style={[styles.liveDot, { backgroundColor: colors.danger }]} />
        <Text style={[styles.liveTitle, { color: colors.text }]}>
          {session ? 'Live now' : 'Bring the group together live'}
        </Text>
        <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
          {session
            ? 'A live room is active. Join when you are ready.'
            : 'Start a lightweight room for a conversation, all-hands, or quick update.'}
        </Text>
        {session ? (
          <View style={styles.actionWrap}>
            <Button
              label="Join room"
              icon="videocam"
              onPress={() => join.mutate()}
              loading={join.isPending}
            />
            {canManage ? (
              <Button
                label="End room"
                variant="danger"
                onPress={() => end.mutate()}
                loading={end.isPending}
              />
            ) : null}
          </View>
        ) : canManage ? (
          <Button
            label="Start room"
            icon="videocam"
            onPress={() => start.mutate()}
            loading={start.isPending}
          />
        ) : null}
      </Card>
    </View>
  );
}

function AboutPanel({
  group,
  onMembers,
  onSettings,
}: {
  group: Group;
  onMembers: () => void;
  onSettings: () => void;
}) {
  const colors = useAppColors();
  return (
    <View style={{ gap: spacing.md }}>
      <Card>
        <SectionHeader title="About this group" />
        <Text style={[typography.body, { color: colors.text }]}>
          {group.description || 'This group has not added a description yet.'}
        </Text>
        <ListRow
          title="Members"
          subtitle={`${group.memberCount} people in this group`}
          leading={
            <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}>
              <Text style={{ color: colors.primary, fontWeight: '900' }}>{group.memberCount}</Text>
            </View>
          }
          onPress={onMembers}
        />
        {group.canManage ? (
          <ListRow
            title="Group settings"
            subtitle="Edit details and manage the group"
            leading={
              <View style={[styles.fileIcon, { backgroundColor: colors.primarySoft }]}>
                <Text style={{ color: colors.primary, fontWeight: '900' }}>⚙</Text>
              </View>
            }
            onPress={onSettings}
          />
        ) : null}
      </Card>
    </View>
  );
}

function CreateAlbumSheet({
  visible,
  groupId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  groupId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const mutation = useMutation({
    mutationFn: () => createGroupAlbum(groupId, { title: title.trim() }),
    onSuccess: () => {
      setTitle('');
      onCreated();
    },
    onError: () => showToast({ tone: 'error', message: 'Could not create album.' }),
  });
  return (
    <ModalSheet
      visible={visible}
      title="Create album"
      onClose={onClose}
      footer={
        <Button
          label="Create album"
          fullWidth
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!title.trim()}
        />
      }
    >
      <TextField label="Album title" value={title} onChangeText={setTitle} autoFocus={visible} />
    </ModalSheet>
  );
}

function CreateEventSheet({
  visible,
  groupId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  groupId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState(
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
  );
  const mutation = useMutation({
    mutationFn: () =>
      createGroupEvent(groupId, {
        title: title.trim(),
        location: location.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }),
    onSuccess: () => {
      setTitle('');
      onCreated();
    },
    onError: () =>
      showToast({
        tone: 'error',
        message: 'Could not create event. Use a valid local date and time.',
      }),
  });
  return (
    <ModalSheet
      visible={visible}
      title="Create event"
      onClose={onClose}
      footer={
        <Button
          label="Create event"
          fullWidth
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!title.trim() || !startsAt.trim()}
        />
      }
    >
      <TextField label="Event title" value={title} onChangeText={setTitle} autoFocus={visible} />
      <TextField label="Location" value={location} onChangeText={setLocation} />
      <TextField
        label="Starts at"
        hint="Use local ISO format, e.g. 2026-08-01T09:30"
        value={startsAt}
        onChangeText={setStartsAt}
        autoCapitalize="none"
      />
    </ModalSheet>
  );
}

export function GroupMembersExperience({ route, navigation }: MembersProps) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const groupId = route.params.groupId;
  const groupQuery = useQuery({
    queryKey: ['groups', 'detail', groupId],
    queryFn: () => getGroup(groupId),
  });
  const membersQuery = useQuery({
    queryKey: ['groups', groupId, 'members'],
    queryFn: () => listGroupMembers(groupId),
  });
  const requestsQuery = useQuery({
    queryKey: ['groups', groupId, 'requests'],
    queryFn: () => listGroupMembershipRequests(groupId),
  });
  const [tab, setTab] = useState<'members' | 'requests' | 'invite'>('members');
  const [query, setQuery] = useState('');
  const peopleQuery = useQuery({
    queryKey: ['search', 'group-invite', query],
    queryFn: () => searchAll({ query, scope: 'users', limit: 8 }),
    enabled: tab === 'invite' && query.trim().length >= 2,
  });
  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'member' }) =>
      updateGroupMemberRole(groupId, id, role),
    onSuccess: () => void membersQuery.refetch(),
    onError: () => showToast({ tone: 'error', message: 'Could not update member role.' }),
  });
  const requestMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'decline' }) =>
      resolveGroupMembershipRequest(groupId, id, action),
    onSuccess: () => {
      void requestsQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not update join request.' }),
  });
  const inviteMutation = useMutation({
    mutationFn: (userId: string) => createGroupInvitation(groupId, userId),
    onSuccess: () => {
      setQuery('');
      showToast({ tone: 'success', message: 'Invitation sent.' });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not send invitation.' }),
  });
  const canManage = Boolean(groupQuery.data?.canManage);
  return (
    <Page scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.detailHeader}>
        <IconButton icon="arrow-back" label="Back" onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={[styles.detailTitle, { color: colors.text }]}>
          People
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'members', label: 'Members' },
          { value: 'requests', label: 'Requests' },
          { value: 'invite', label: 'Invite' },
        ]}
      />
      {tab === 'members' ? (
        membersQuery.isLoading ? (
          <FeedSkeleton count={2} />
        ) : (
          (membersQuery.data?.items ?? []).map((member) => (
            <Card key={member.userId}>
              <ListRow
                title={member.displayName}
                subtitle={member.role || 'member'}
                leading={<Avatar name={member.displayName} uri={member.avatarUrl} />}
                trailing={
                  canManage && member.role !== 'owner' ? (
                    <Button
                      label={member.role === 'admin' ? 'Make member' : 'Make admin'}
                      variant="secondary"
                      onPress={() =>
                        roleMutation.mutate({
                          id: member.userId,
                          role: member.role === 'admin' ? 'member' : 'admin',
                        })
                      }
                    />
                  ) : undefined
                }
              />
            </Card>
          ))
        )
      ) : null}
      {tab === 'requests' ? (
        (requestsQuery.data?.items ?? []).length ? (
          requestsQuery.data?.items.map((request) => (
            <Card key={request.id}>
              <ListRow
                title={request.requester.displayName}
                subtitle={request.message || 'Wants to join this group'}
                leading={
                  <Avatar name={request.requester.displayName} uri={request.requester.avatarUrl} />
                }
              />
              <View style={styles.actionPair}>
                <Button
                  label="Approve"
                  onPress={() => requestMutation.mutate({ id: request.id, action: 'approve' })}
                />
                <Button
                  label="Decline"
                  variant="secondary"
                  onPress={() => requestMutation.mutate({ id: request.id, action: 'decline' })}
                />
              </View>
            </Card>
          ))
        ) : (
          <EmptyState title="No join requests" body="New requests will appear here." />
        )
      ) : null}
      {tab === 'invite' ? (
        <View style={{ gap: spacing.sm }}>
          <TextField
            label="Find colleagues"
            value={query}
            onChangeText={setQuery}
            placeholder="Search people"
            leadingIcon="search"
          />
          {(peopleQuery.data?.users ?? []).map((person) => (
            <Card key={person.id}>
              <ListRow
                title={person.displayName}
                subtitle={person.email}
                leading={<Avatar name={person.displayName} uri={person.avatarUrl} />}
                trailing={
                  <Button
                    label="Invite"
                    onPress={() => inviteMutation.mutate(person.id)}
                    loading={inviteMutation.isPending}
                  />
                }
              />
            </Card>
          ))}
        </View>
      ) : null}
    </Page>
  );
}

export function GroupSettingsExperience({ route, navigation }: SettingsProps) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const groupId = route.params.groupId;
  const groupQuery = useQuery({
    queryKey: ['groups', 'detail', groupId],
    queryFn: () => getGroup(groupId),
  });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('Open');
  React.useEffect(() => {
    if (groupQuery.data) {
      setName(groupQuery.data.name);
      setDescription(groupQuery.data.description || '');
      setPrivacy(groupQuery.data.groupPrivacy);
    }
  }, [groupQuery.data]);
  const mutation = useMutation({
    mutationFn: () =>
      updateGroup(groupId, {
        name: name.trim(),
        description: description.trim() || undefined,
        groupPrivacy: privacy,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      showToast({ tone: 'success', message: 'Group settings saved.' });
      navigation.goBack();
    },
    onError: () => showToast({ tone: 'error', message: 'Could not save group settings.' }),
  });
  if (groupQuery.isLoading)
    return (
      <Page>
        <FeedSkeleton count={1} />
      </Page>
    );
  if (!groupQuery.data?.canManage)
    return (
      <Page>
        <EmptyState
          title="Admin access required"
          body="Only group administrators can change these settings."
          icon="lock"
        />
      </Page>
    );
  return (
    <Page scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.detailHeader}>
        <IconButton icon="arrow-back" label="Back" onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={[styles.detailTitle, { color: colors.text }]}>
          Group settings
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <TextField label="Group name" value={name} onChangeText={setName} />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline />
      <SectionHeader title="Privacy" />
      <View style={styles.privacyOptions}>
        {(['Open', 'Closed', 'Secret'] as const).map((value) => (
          <Chip
            key={value}
            label={value}
            selected={privacy === value}
            onPress={() => setPrivacy(value)}
          />
        ))}
      </View>
      <Button
        label="Save changes"
        fullWidth
        onPress={() => mutation.mutate()}
        loading={mutation.isPending}
        disabled={!name.trim()}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  directory: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  directoryHeader: { gap: spacing.md },
  simpleTopBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },
  invitation: { gap: spacing.xs },
  actionPair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  directoryCount: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  groupCard: { gap: spacing.xs },
  groupMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  privacyPill: { borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  privacyOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  hubContent: { paddingBottom: spacing.xxl },
  hubHeader: { gap: spacing.md },
  hubHero: {
    minHeight: 210,
    padding: spacing.md,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  hubHeroCopy: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hubName: { color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '900' },
  hubMeta: { color: '#EEE7FF', fontSize: 14, lineHeight: 19 },
  hubHeroActions: { alignItems: 'flex-start' },
  hubTabs: { paddingHorizontal: spacing.md, gap: spacing.xs },
  hubPanel: { padding: spacing.md },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: { fontSize: 17, lineHeight: 23, fontWeight: '900' },
  actionWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  liveCard: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  liveDot: { width: 12, height: 12, borderRadius: 6 },
  liveTitle: { fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  detailHeader: {
    minHeight: 56,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailTitle: { flex: 1, textAlign: 'center', fontSize: 18, lineHeight: 24, fontWeight: '900' },
});
