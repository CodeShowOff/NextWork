import React, { useMemo, useState } from 'react';
import {
  FlatList,
  ImageStyle,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  CommentItem,
  PaginatedComments,
  createComment,
  deleteComment,
  listComments,
  reportComment,
  updateComment,
} from '../shared/api/comments.api';
import {
  FeedPost,
  createPost,
  deletePost,
  getPost,
  updatePost,
  votePostPoll,
} from '../shared/api/feed.api';
import { Group, listGroups } from '../shared/api/groups.api';
import { getLikeState, likePost, unlikePost } from '../shared/api/likes.api';
import { getMediaDownload, uploadImageWithContract } from '../shared/api/media.api';
import { listMyOrganizations } from '../shared/api/organizations.api';
import { SearchUserItem, searchAll } from '../shared/api/search.api';
import { getCurrentUser } from '../shared/api/users.api';
import { radius, spacing, useAppColors } from '../shared/ui/design-tokens';
import {
  Avatar,
  Button,
  Card,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  FeedSkeleton,
  IconButton,
  ListRow,
  ModalSheet,
  SectionHeader,
  Skeleton,
  TextField,
} from '../presentation/components';
import { useToast } from '../presentation/feedback';
import { Page, useAdaptiveLayout } from '../presentation/layout';
import { OfflineBanner, useNetwork, useStoredDraft } from '../presentation/resilience';
import { RootStackParamList } from './navigation';

type HomeProps = NativeStackScreenProps<RootStackParamList, 'Main'>;
type DetailProps = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

const PAGE_SIZE = 20;

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function inferImageType(
  mimeType: string | null | undefined,
): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/jpeg')
    return mimeType;
  return 'image/jpeg';
}

function useActiveOrganization() {
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: listMyOrganizations,
  });
  const organizationId =
    meQuery.data?.activeOrganizationId ?? organizationsQuery.data?.items[0]?.organizationId;
  return { meQuery, organizationsQuery, organizationId };
}

export function HomeExperience({ navigation }: HomeProps) {
  const colors = useAppColors();
  const layout = useAdaptiveLayout();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isOnline } = useNetwork();
  const { meQuery, organizationId } = useActiveOrganization();
  const groupsQuery = useQuery({
    queryKey: ['groups', organizationId],
    queryFn: () => listGroups(organizationId as string),
    enabled: Boolean(organizationId),
  });
  const [groupId, setGroupId] = useState<string | undefined>();
  const [composerVisible, setComposerVisible] = useState(false);
  const feedQuery = useInfiniteQuery({
    queryKey: ['feed', groupId || 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => createFeedRequest(groupId, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const feed = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );

  const refresh = () => void Promise.all([feedQuery.refetch(), groupsQuery.refetch()]);
  const visibleGroups = groupsQuery.data?.items ?? [];

  return (
    <Page keyboardAware={false} style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.feedContent,
          layout.isCompact ? null : { alignSelf: 'center', width: '100%', maxWidth: 760 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={feedQuery.isRefetching}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage)
            void feedQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.45}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.topBar}>
              <View style={styles.wordmark}>
                <View style={[styles.wordmarkBadge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.wordmarkLetter, { color: colors.onAccent }]}>W</Text>
                </View>
                <Text style={[styles.wordmarkText, { color: colors.text }]}>Workplace</Text>
              </View>
              <View style={styles.topActions}>
                <IconButton
                  icon="search"
                  label="Search Workplace"
                  onPress={() => navigation.navigate('Search')}
                  testID="header-search"
                />
                <IconButton
                  icon="account-circle"
                  label="Open your profile"
                  onPress={() => navigation.navigate('Profile')}
                  testID="header-profile"
                />
              </View>
            </View>
            <OfflineBanner />
            <Card raised style={styles.composeTrigger}>
              <Pressable
                testID="home-compose"
                accessibilityRole="button"
                onPress={() => setComposerVisible(true)}
                style={styles.composePress}
              >
                <Avatar name={meQuery.data?.email ?? 'You'} size={40} />
                <Text style={[styles.composePlaceholder, { color: colors.textMuted }]}>
                  Share an update with your team
                </Text>
                <MaterialIcons name="edit" size={20} color={colors.primary} />
              </Pressable>
              <View style={[styles.composeShortcuts, { borderTopColor: colors.border }]}>
                <Button
                  label="Post"
                  icon="edit"
                  variant="ghost"
                  onPress={() => setComposerVisible(true)}
                />
                <Button
                  label="Photo"
                  icon="image"
                  variant="ghost"
                  onPress={() => setComposerVisible(true)}
                />
                <Button
                  label="Poll"
                  icon="poll"
                  variant="ghost"
                  onPress={() => setComposerVisible(true)}
                />
              </View>
            </Card>
            <View style={styles.feedIntro}>
              <SectionHeader
                title={
                  groupId
                    ? (visibleGroups.find((group) => group.id === groupId)?.name ?? 'Group feed')
                    : 'Your feed'
                }
                overline="TEAM UPDATES"
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.groupChips}
              >
                <Chip
                  label="All updates"
                  selected={!groupId}
                  onPress={() => setGroupId(undefined)}
                  icon="home"
                />
                {visibleGroups.slice(0, 9).map((group) => (
                  <Chip
                    key={group.id}
                    label={group.name}
                    selected={group.id === groupId}
                    onPress={() => setGroupId(group.id)}
                    icon="groups"
                  />
                ))}
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={
          feedQuery.isLoading ? (
            <FeedSkeleton />
          ) : feedQuery.isError ? (
            <ErrorState onRetry={() => void feedQuery.refetch()} />
          ) : (
            <EmptyState
              title="No updates yet"
              body="Be the first to share something useful with your team."
              action={{ label: 'Write an update', onPress: () => setComposerVisible(true) }}
            />
          )
        }
        ListFooterComponent={
          feedQuery.isFetchingNextPage ? (
            <View style={styles.footerLoad}>
              <Skeleton width={120} />
            </View>
          ) : (
            <View style={{ height: spacing.xxl }} />
          )
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            currentUserId={meQuery.data?.id}
            onOpen={() => navigation.navigate('PostDetail', { post: item })}
            onOpenProfile={(userId) => navigation.navigate('Profile', { userId })}
            onChanged={() => {
              void queryClient.invalidateQueries({ queryKey: ['feed'] });
            }}
          />
        )}
      />
      <PostComposerSheet
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        groups={visibleGroups}
        defaultGroupId={groupId}
        onPosted={() => {
          setComposerVisible(false);
          void queryClient.invalidateQueries({ queryKey: ['feed'] });
          showToast({ tone: 'success', message: 'Your update was posted.' });
        }}
        online={isOnline}
      />
    </Page>
  );
}

async function createFeedRequest(groupId: string | undefined, before: string | undefined) {
  const { listFeed } = await import('../shared/api/feed.api');
  return listFeed({ limit: PAGE_SIZE, before, ...(groupId ? { groupId } : {}) });
}

function PostComposerSheet({
  visible,
  onClose,
  onPosted,
  groups,
  defaultGroupId,
  online,
}: {
  visible: boolean;
  onClose: () => void;
  onPosted: () => void;
  groups: Group[];
  defaultGroupId?: string;
  online: boolean;
}) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const draft = useStoredDraft('workplace.draft.post');
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(defaultGroupId);
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [tagQuery, setTagQuery] = useState('');
  const [tagged, setTagged] = useState<SearchUserItem[]>([]);
  const peopleQuery = useQuery({
    queryKey: ['search', 'post-tags', tagQuery],
    queryFn: () => searchAll({ query: tagQuery, scope: 'users', limit: 6 }),
    enabled: tagQuery.trim().length >= 2 && visible,
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const content = draft.value.trim();
      if (!content) throw new Error('Write an update before posting.');
      const media = [] as Array<{ mediaId: string; type: string; width?: number; height?: number }>;
      if (image) {
        const contentType = inferImageType(image.mimeType);
        const uploaded = await uploadImageWithContract({
          localUri: image.uri,
          fileName: image.fileName ?? `update-${Date.now()}.jpg`,
          contentType,
          sizeBytes: image.fileSize,
          groupId: selectedGroupId,
        });
        media.push({
          mediaId: uploaded.mediaId,
          type: contentType,
          width: image.width,
          height: image.height,
        });
      }
      const cleanOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
      if (pollEnabled && (!pollQuestion.trim() || cleanOptions.length < 2))
        throw new Error('A poll needs a question and at least two options.');
      return createPost({
        content,
        ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
        ...(tagged.length ? { taggedUserIds: tagged.map((person) => person.id) } : {}),
        ...(media.length ? { media } : {}),
        ...(pollEnabled
          ? {
              poll: {
                question: pollQuestion.trim(),
                options: cleanOptions.map((text) => ({ text })),
              },
            }
          : {}),
      });
    },
    onSuccess: () => {
      draft.clear();
      setImage(null);
      setPollEnabled(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setTagged([]);
      onPosted();
    },
    onError: (error) =>
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not post update.',
      }),
  });

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast({ tone: 'error', message: 'Photo library access is needed to attach an image.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0]);
  };

  return (
    <ModalSheet
      visible={visible}
      title="Create post"
      onClose={onClose}
      footer={
        <Button
          testID="post-submit"
          fullWidth
          label="Post update"
          icon="send"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!online || !draft.value.trim()}
        />
      }
    >
      <View style={styles.composerBody}>
        {!online ? (
          <View style={[styles.offlineNote, { backgroundColor: colors.surfaceTint }]}>
            <Text style={{ color: colors.textMuted }}>
              You can keep writing, but connect to post this update.
            </Text>
          </View>
        ) : null}
        <TextField
          testID="post-content"
          value={draft.value}
          onChangeText={draft.setValue}
          placeholder="What would you like to share?"
          multiline
          autoFocus={visible}
          inputStyle={{ minHeight: 124 }}
        />
        <SectionHeader title="Share with" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupChips}
        >
          <Chip
            label="Everyone"
            selected={!selectedGroupId}
            onPress={() => setSelectedGroupId(undefined)}
          />
          {groups.map((group) => (
            <Chip
              key={group.id}
              label={group.name}
              selected={selectedGroupId === group.id}
              onPress={() => setSelectedGroupId(group.id)}
            />
          ))}
        </ScrollView>
        <View style={styles.composerTools}>
          <Button
            label={image ? 'Change photo' : 'Add photo'}
            icon="image"
            variant="secondary"
            onPress={() => void pickImage()}
          />
          <Button
            testID="post-poll-toggle"
            label={pollEnabled ? 'Remove poll' : 'Add poll'}
            icon="poll"
            variant="secondary"
            onPress={() => setPollEnabled((value) => !value)}
          />
        </View>
        {image ? (
          <View style={styles.imageAttachment}>
            <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
              {image.fileName ?? 'Selected photo'}
            </Text>
            <IconButton icon="close" label="Remove selected photo" onPress={() => setImage(null)} />
          </View>
        ) : null}
        {pollEnabled ? (
          <View style={styles.pollForm}>
            <TextField
              label="Question"
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder="Ask your team a question"
            />
            <Text style={[styles.smallLabel, { color: colors.textMuted }]}>Options</Text>
            {pollOptions.map((option, index) => (
              <TextField
                key={index}
                value={option}
                onChangeText={(value) =>
                  setPollOptions((current) =>
                    current.map((item, position) => (position === index ? value : item)),
                  )
                }
                placeholder={`Option ${index + 1}`}
              />
            ))}
            {pollOptions.length < 6 ? (
              <Button
                label="Add another option"
                icon="add"
                variant="ghost"
                onPress={() => setPollOptions((current) => [...current, ''])}
              />
            ) : null}
          </View>
        ) : null}
        <View style={styles.tagArea}>
          <TextField
            label="Tag teammates"
            value={tagQuery}
            onChangeText={setTagQuery}
            placeholder="Search people"
            leadingIcon="alternate-email"
          />
          {(peopleQuery.data?.users ?? [])
            .filter((person) => !tagged.some((tag) => tag.id === person.id))
            .map((person) => (
              <ListRow
                key={person.id}
                title={person.displayName}
                subtitle={person.email}
                leading={<Avatar name={person.displayName} uri={person.avatarUrl} size={36} />}
                onPress={() => {
                  setTagged((current) => [...current, person]);
                  setTagQuery('');
                }}
              />
            ))}
          {tagged.length ? (
            <View style={styles.taggedRow}>
              {tagged.map((person) => (
                <Chip
                  key={person.id}
                  label={person.displayName}
                  selected
                  onPress={() =>
                    setTagged((current) => current.filter((item) => item.id !== person.id))
                  }
                  icon="close"
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </ModalSheet>
  );
}

export function PostCard({
  post,
  currentUserId,
  onOpen,
  onOpenProfile,
  onChanged,
  compact = false,
}: {
  post: FeedPost;
  currentUserId?: string;
  onOpen: () => void;
  onOpenProfile: (userId: string) => void;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const [liked, setLiked] = useState<boolean | null>(null);
  const [likeCount, setLikeCount] = useState(post.stats.likeCount);
  const [showEdit, setShowEdit] = useState(false);
  const [content, setContent] = useState(post.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();
  const isOwner = post.authorId === currentUserId;
  const likeMutation = useMutation({
    mutationFn: async () => {
      const state = liked === null ? await getLikeState(post.id) : { likedByMe: liked };
      return state.likedByMe ? unlikePost(post.id) : likePost(post.id);
    },
    onSuccess: (result) => {
      setLiked(result.liked);
      setLikeCount(result.likeCount);
      onChanged?.();
    },
    onError: () => showToast({ tone: 'error', message: 'Could not update your reaction.' }),
  });
  const updateMutation = useMutation({
    mutationFn: () => updatePost(post.id, { content: content.trim() }),
    onSuccess: () => {
      setShowEdit(false);
      onChanged?.();
      showToast({ tone: 'success', message: 'Post updated.' });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not update this post.' }),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deletePost(post.id),
    onSuccess: () => {
      setConfirmDelete(false);
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      showToast({ tone: 'success', message: 'Post deleted.' });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not delete this post.' }),
  });
  const voteMutation = useMutation({
    mutationFn: (optionId: string) => votePostPoll(post.id, optionId),
    onSuccess: () => onChanged?.(),
    onError: () => showToast({ tone: 'error', message: 'Could not submit your vote.' }),
  });

  return (
    <Card raised={compact} style={styles.postCard}>
      <View style={styles.postHeader}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenProfile(post.author.id)}
          style={styles.authorButton}
        >
          <Avatar name={post.author.displayName} uri={post.author.avatarUrl} />
          <View style={styles.authorCopy}>
            <Text numberOfLines={1} style={[styles.authorName, { color: colors.text }]}>
              {post.author.displayName}
            </Text>
            <Text numberOfLines={1} style={[styles.postMeta, { color: colors.textMuted }]}>
              {relativeTime(post.createdAt)} ·{' '}
              {post.visibility === 'public' ? 'Everyone' : post.visibility}
            </Text>
          </View>
        </Pressable>
        {isOwner ? (
          <IconButton
            icon="more-horiz"
            label="Post options"
            onPress={() => setShowEdit((value) => !value)}
          />
        ) : null}
      </View>
      {showEdit ? (
        <View style={[styles.inlineEdit, { backgroundColor: colors.surfaceMuted }]}>
          <TextField value={content} onChangeText={setContent} multiline />
          <View style={styles.inlineActions}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setContent(post.content);
                setShowEdit(false);
              }}
            />
            <Button
              label="Save"
              onPress={() => updateMutation.mutate()}
              loading={updateMutation.isPending}
              disabled={!content.trim()}
            />
            <Button label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} />
          </View>
        </View>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.postBodyPress}>
        <Text style={[styles.postBody, { color: colors.text }]}>{post.content}</Text>
        {post.media.map((media) => (
          <PostMedia
            key={media.id}
            mediaId={media.mediaId}
            url={media.url}
            type={media.type}
            width={media.width}
            height={media.height}
          />
        ))}
        {post.poll ? (
          <View
            style={[
              styles.poll,
              { borderColor: colors.border, backgroundColor: colors.surfaceTint },
            ]}
          >
            <Text style={[styles.pollQuestion, { color: colors.text }]}>{post.poll.question}</Text>
            {post.poll.options.map((option) => {
              const selected = post.poll?.votedOptionId === option.id;
              const percent = post.poll?.totalVotes
                ? Math.round((option.voteCount / post.poll.totalVotes) * 100)
                : 0;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Vote for ${option.text}`}
                  onPress={() => {
                    if (!post.poll?.votedOptionId) voteMutation.mutate(option.id);
                  }}
                  style={[
                    styles.pollOption,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primarySoft : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.pollOptionText, { color: colors.text }]}>{option.text}</Text>
                  <Text style={{ color: colors.textMuted, fontWeight: '800' }}>{percent}%</Text>
                </Pressable>
              );
            })}
            <Text style={[styles.postMeta, { color: colors.textMuted }]}>
              {post.poll.totalVotes} votes
            </Text>
          </View>
        ) : null}
      </Pressable>
      <View style={[styles.engagementSummary, { borderTopColor: colors.border }]}>
        <Text style={{ color: colors.textMuted }}>
          {likeCount
            ? `${likeCount} ${likeCount === 1 ? 'reaction' : 'reactions'}`
            : 'Be the first to react'}
        </Text>
        <Text style={{ color: colors.textMuted }}>
          {post.stats.commentCount ? `${post.stats.commentCount} comments` : ''}
        </Text>
      </View>
      <View style={styles.engagementActions}>
        <Button
          label={liked ? 'Reacted' : 'React'}
          icon={liked ? 'thumb-up' : 'thumb-up-off-alt'}
          variant="ghost"
          onPress={() => likeMutation.mutate()}
          loading={likeMutation.isPending}
        />
        <Button label="Comment" icon="chat-bubble-outline" variant="ghost" onPress={onOpen} />
        <Button
          label="Share"
          icon="share"
          variant="ghost"
          onPress={() =>
            showToast({
              tone: 'info',
              message: 'Sharing is available from the post detail screen.',
            })
          }
        />
      </View>
      <ConfirmSheet
        visible={confirmDelete}
        title="Delete this post?"
        body="This will permanently remove the update and its activity."
        confirmLabel="Delete post"
        destructive
        loading={deleteMutation.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
      />
    </Card>
  );
}

function PostMedia({
  mediaId,
  url,
  type,
  width,
  height,
}: {
  mediaId: string | null;
  url: string | null;
  type: string;
  width: number | null;
  height: number | null;
}) {
  const colors = useAppColors();
  const downloadQuery = useQuery({
    queryKey: ['media', 'download', mediaId],
    queryFn: () => getMediaDownload(mediaId as string),
    enabled: Boolean(mediaId && !url),
    staleTime: 240_000,
  });
  const source = url ?? downloadQuery.data?.downloadUrl;
  if (!source) return <Skeleton height={180} radius={radius.md} />;
  if (!type.startsWith('image/'))
    return (
      <View
        style={[
          styles.videoPlaceholder,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <MaterialIcons name="play-circle-outline" size={34} color={colors.primary} />
        <Text style={{ color: colors.text, fontWeight: '800' }}>
          Open {type.startsWith('video') ? 'video' : 'attachment'}
        </Text>
      </View>
    );
  const imageStyle: ImageStyle = {
    width: '100%',
    height:
      width && height ? Math.min(380, Math.max(180, Math.round((height / width) * 340))) : 260,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  };
  return (
    <ExpoImage
      source={{ uri: source }}
      contentFit="cover"
      transition={180}
      style={imageStyle}
      accessibilityLabel="Post attachment"
    />
  );
}

export function PostDetailExperience({ route, navigation }: DetailProps) {
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { isOnline } = useNetwork();
  const { meQuery } = useActiveOrganization();
  const canonicalQuery = useQuery({
    queryKey: ['posts', route.params.post.id],
    queryFn: () => getPost(route.params.post.id),
    initialData: route.params.post,
  });
  const post = canonicalQuery.data;
  const commentsQuery = useInfiniteQuery({
    queryKey: ['comments', route.params.post.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listComments(route.params.post.id, { limit: 30, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [commentsQuery.data],
  );
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const commentMutation = useMutation({
    mutationFn: () =>
      createComment({
        postId: route.params.post.id,
        body: comment.trim(),
        ...(replyTo ? { parentCommentId: replyTo.id } : {}),
      }),
    onSuccess: (created) => {
      setComment('');
      setReplyTo(null);
      queryClient.setQueryData<InfiniteData<PaginatedComments>>(
        ['comments', route.params.post.id],
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page, index) =>
                  index === 0 ? { ...page, items: [created, ...page.items] } : page,
                ),
              }
            : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) =>
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not add comment.',
      }),
  });

  if (!post)
    return (
      <Page>
        <ErrorState onRetry={() => void canonicalQuery.refetch()} />
      </Page>
    );
  return (
    <Page edges={['top', 'left', 'right', 'bottom']}>
      <View
        style={[
          styles.detailHeader,
          { borderBottomColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <IconButton icon="arrow-back" label="Back" onPress={() => navigation.goBack()} />
        <Text accessibilityRole="header" style={[styles.detailTitle, { color: colors.text }]}>
          Post
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.detailList}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage)
            void commentsQuery.fetchNextPage();
        }}
        ListHeaderComponent={
          <>
            <PostCard
              post={post}
              currentUserId={meQuery.data?.id}
              onOpen={() => undefined}
              onOpenProfile={(userId) => navigation.navigate('Profile', { userId })}
              onChanged={() => {
                void canonicalQuery.refetch();
                void queryClient.invalidateQueries({ queryKey: ['feed'] });
              }}
              compact
            />
            <SectionHeader title={comments.length ? `${comments.length} comments` : 'Comments'} />
          </>
        }
        ListEmptyComponent={
          commentsQuery.isLoading ? (
            <FeedSkeleton count={1} />
          ) : (
            <EmptyState
              title="Start the conversation"
              body="Thoughtful replies help your team move work forward."
            />
          )
        }
        renderItem={({ item }) => (
          <CommentRow
            item={item}
            currentUserId={meQuery.data?.id}
            onReply={() => {
              setReplyTo(item);
            }}
            onChanged={() => void commentsQuery.refetch()}
          />
        )}
      />
      <View
        style={[
          styles.commentComposer,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        {replyTo ? (
          <View style={[styles.replyBanner, { backgroundColor: colors.surfaceTint }]}>
            <Text style={{ color: colors.textMuted, flex: 1 }} numberOfLines={1}>
              Replying to {replyTo.author.displayName}
            </Text>
            <IconButton icon="close" label="Cancel reply" onPress={() => setReplyTo(null)} />
          </View>
        ) : null}
        <View style={styles.commentInputRow}>
          <TextField
            value={comment}
            onChangeText={setComment}
            placeholder="Write a comment"
            inputStyle={{ minHeight: 42, maxHeight: 100 }}
            multiline
            style={{ flex: 1 }}
          />
          <IconButton
            icon="send"
            label="Send comment"
            onPress={() => commentMutation.mutate()}
            disabled={!isOnline || !comment.trim() || commentMutation.isPending}
          />
        </View>
      </View>
    </Page>
  );
}

function CommentRow({
  item,
  currentUserId,
  onReply,
  onChanged,
}: {
  item: CommentItem;
  currentUserId?: string;
  onReply: () => void;
  onChanged: () => void;
}) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body);
  const editMutation = useMutation({
    mutationFn: () => updateComment(item.id, body.trim()),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
    onError: () => showToast({ tone: 'error', message: 'Could not update this comment.' }),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteComment(item.id),
    onSuccess: onChanged,
    onError: () => showToast({ tone: 'error', message: 'Could not delete this comment.' }),
  });
  const reportMutation = useMutation({
    mutationFn: () => reportComment(item.id, 'other'),
    onSuccess: () =>
      showToast({ tone: 'success', message: 'Thanks. This comment has been reported.' }),
    onError: () => showToast({ tone: 'error', message: 'Could not report this comment.' }),
  });
  const isOwner = item.author.id === currentUserId;
  return (
    <View style={styles.commentRow}>
      <Avatar name={item.author.displayName} uri={item.author.avatarUrl} size={34} />
      <View style={[styles.commentBubble, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.commentName, { color: colors.text }]}>{item.author.displayName}</Text>
        {editing ? (
          <>
            <TextField value={body} onChangeText={setBody} multiline />
            <View style={styles.inlineActions}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setEditing(false);
                  setBody(item.body);
                }}
              />
              <Button
                label="Save"
                onPress={() => editMutation.mutate()}
                loading={editMutation.isPending}
              />
            </View>
          </>
        ) : (
          <Text style={[styles.commentBody, { color: colors.text }]}>{item.body}</Text>
        )}
        <View style={styles.commentActions}>
          <Button label="Reply" variant="ghost" onPress={onReply} />
          {isOwner ? (
            <>
              <Button label="Edit" variant="ghost" onPress={() => setEditing(true)} />
              <Button
                label="Delete"
                variant="ghost"
                onPress={() => deleteMutation.mutate()}
                loading={deleteMutation.isPending}
              />
            </>
          ) : (
            <Button
              label="Report"
              variant="ghost"
              onPress={() => reportMutation.mutate()}
              loading={reportMutation.isPending}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  feedContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  headerStack: { gap: spacing.md, marginBottom: spacing.xs },
  topBar: {
    minHeight: 58,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wordmarkBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkLetter: { fontSize: 19, lineHeight: 23, fontWeight: '900' },
  wordmarkText: { fontSize: 21, lineHeight: 26, fontWeight: '900', letterSpacing: -0.2 },
  topActions: { flexDirection: 'row' },
  composeTrigger: { padding: 0, gap: 0, overflow: 'hidden' },
  composePress: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  composePlaceholder: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20 },
  composeShortcuts: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  feedIntro: { gap: spacing.xs },
  groupChips: { gap: spacing.xs, paddingRight: spacing.md },
  footerLoad: { alignItems: 'center', paddingVertical: spacing.md },
  composerBody: { gap: spacing.md, paddingBottom: spacing.sm },
  composerTools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  imageAttachment: {
    minHeight: 48,
    borderRadius: radius.sm,
    paddingLeft: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pollForm: { gap: spacing.sm },
  smallLabel: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  tagArea: { gap: spacing.xs },
  taggedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  offlineNote: { padding: spacing.sm, borderRadius: radius.sm },
  postCard: { gap: spacing.sm },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  authorButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  authorCopy: { flex: 1, minWidth: 0, gap: 2 },
  authorName: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  postMeta: { fontSize: 12, lineHeight: 17 },
  postBodyPress: { gap: spacing.sm },
  postBody: { fontSize: 16, lineHeight: 24 },
  inlineEdit: { padding: spacing.sm, borderRadius: radius.sm, gap: spacing.sm },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  videoPlaceholder: {
    minHeight: 160,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  poll: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  pollQuestion: { fontSize: 16, lineHeight: 22, fontWeight: '800', marginBottom: 2 },
  pollOption: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pollOptionText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  engagementSummary: {
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  engagementActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: -spacing.sm,
  },
  detailHeader: {
    minHeight: 56,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailTitle: { flex: 1, textAlign: 'center', fontSize: 18, lineHeight: 24, fontWeight: '900' },
  detailList: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  commentComposer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  replyBanner: {
    minHeight: 36,
    borderRadius: radius.sm,
    paddingLeft: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  commentBubble: { flex: 1, minWidth: 0, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  commentName: { fontSize: 13, lineHeight: 17, fontWeight: '900' },
  commentBody: { fontSize: 15, lineHeight: 21 },
  commentActions: { marginHorizontal: -spacing.xs, flexDirection: 'row', flexWrap: 'wrap' },
});
