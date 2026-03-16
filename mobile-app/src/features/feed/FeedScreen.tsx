import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  RefreshControl,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { createPost, FeedPost, listFeed, PaginatedFeed } from '../../shared/api/feed.api';
import { listGroups } from '../../shared/api/groups.api';
import { getLikeState, likePost, unlikePost } from '../../shared/api/likes.api';
import { uploadImageWithContract } from '../../shared/api/media.api';
import { listMyOrganizations } from '../../shared/api/organizations.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { FeedStackParamList } from './screens/FeedStack';
import { applyOptimisticLikeToFeed, reconcileLikeCountInFeed } from './engagement-cache';

const pageSize = 20;

interface ComposerImage {
  uri: string;
  fileName: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  width?: number;
  height?: number;
  sizeBytes?: number;
}

function inferContentType(fileName: string | undefined, mimeType: string | null): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (mimeType === 'image/png' || mimeType === 'image/webp' || mimeType === 'image/jpeg') {
    return mimeType;
  }

  const lowerName = fileName?.toLowerCase() ?? '';
  if (lowerName.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerName.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

type Props = NativeStackScreenProps<FeedStackParamList, 'FeedHome'>;

export function FeedScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [composerText, setComposerText] = useState('');
  const [composerImage, setComposerImage] = useState<ComposerImage | null>(null);
  const [likedByMeMap, setLikedByMeMap] = useState<Record<string, boolean>>({});
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const meQuery = useQuery({
    queryKey: ['users', 'me'],
    queryFn: getCurrentUser,
  });

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: listMyOrganizations,
  });

  const organizations = organizationsQuery.data?.items ?? [];
  const activeOrganizationId = useMemo(() => {
    if (!organizations.length) {
      return undefined;
    }

    const active = meQuery.data?.activeOrganizationId;
    if (!active) {
      return organizations[0].organizationId;
    }

    return organizations.find((organization) => organization.organizationId === active)?.organizationId;
  }, [meQuery.data?.activeOrganizationId, organizations]);

  const groupsQuery = useQuery({
    queryKey: ['groups', activeOrganizationId],
    queryFn: () => listGroups(activeOrganizationId as string),
    enabled: Boolean(activeOrganizationId),
  });

  const groupNameById = useMemo(
    () =>
      Object.fromEntries((groupsQuery.data?.items ?? []).map((group) => [group.id, group.name])) as Record<
        string,
        string
      >,
    [groupsQuery.data?.items],
  );

  const feedQuery = useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listFeed({ limit: pageSize, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const content = composerText.trim();
      if (!content) {
        throw new Error('Write something before posting.');
      }

      let mediaPayload:
        | {
            url: string;
            type: string;
            width?: number;
            height?: number;
          }[]
        | undefined;

      if (composerImage) {
        const contract = await uploadImageWithContract({
          localUri: composerImage.uri,
          fileName: composerImage.fileName,
          contentType: composerImage.contentType,
          sizeBytes: composerImage.sizeBytes,
        });

        mediaPayload = [
          {
            url: contract.publicUrl,
            type: composerImage.contentType,
            width: composerImage.width,
            height: composerImage.height,
          },
        ];
      }

      return createPost({
        content,
        ...(selectedGroupId ? { groupId: selectedGroupId } : {}),
        ...(mediaPayload ? { media: mediaPayload } : {}),
      });
    },
    onSuccess: (created) => {
      setComposerText('');
      setComposerImage(null);
      queryClient.setQueryData(
        ['feed'],
        (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) => {
          if (!current || current.pages.length === 0) {
            return {
              pageParams: [undefined],
              pages: [{ items: [created], nextCursor: null }],
            };
          }

          const first = current.pages[0];
          const nextFirst = {
            ...first,
            items: [created, ...first.items],
          };

          return {
            ...current,
            pages: [nextFirst, ...current.pages.slice(1)],
          };
        },
      );
    },
    onError: (error) => {
      Alert.alert('Could not create post', (error as Error).message);
    },
  });

  async function pickComposerImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo access to attach images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: false,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    const asset = result.assets[0];
    const fileName = asset.fileName ?? `post-${Date.now()}.jpg`;
    setComposerImage({
      uri: asset.uri,
      fileName,
      contentType: inferContentType(fileName, asset.mimeType ?? null),
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.fileSize,
    });
  }

  const toggleLikeMutation = useMutation({
    mutationFn: async (postId: string) => {
      let likedByMe = likedByMeMap[postId];
      if (likedByMe === undefined) {
        const likeState = await getLikeState(postId);
        likedByMe = likeState.likedByMe;
      }

      const result = likedByMe ? await unlikePost(postId) : await likePost(postId);
      return { postId, result };
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previousFeed = queryClient.getQueryData<{ pageParams: unknown[]; pages: PaginatedFeed[] }>(['feed']);

      const likedByMeBefore = likedByMeMap[postId] ?? false;
      const previousLikedByMe = likedByMeMap[postId];
      const optimistic = applyOptimisticLikeToFeed(previousFeed, {
        postId,
        likedByMeBefore,
      });

      setLikedByMeMap((current) => ({
        ...current,
        [postId]: optimistic.nextLikedByMe,
      }));
      queryClient.setQueryData(['feed'], optimistic.nextFeed);

      return {
        postId,
        previousFeed,
        previousLikedByMe,
      };
    },
    onSuccess: ({ postId, result }) => {
      setLikedByMeMap((current) => ({
        ...current,
        [postId]: result.liked,
      }));

      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        reconcileLikeCountInFeed(current, {
          postId,
          likeCount: result.likeCount,
        }),
      );
    },
    onError: (error, _postId, context) => {
      if (!context) {
        Alert.alert('Could not update like', (error as Error).message);
        return;
      }

      if (context.previousFeed) {
        queryClient.setQueryData(['feed'], context.previousFeed);
      }

      if (context.previousLikedByMe === undefined) {
        setLikedByMeMap((current) => {
          const next = { ...current };
          delete next[context.postId];
          return next;
        });
      } else {
        setLikedByMeMap((current) => ({
          ...current,
          [context.postId]: context.previousLikedByMe,
        }));
      }

      Alert.alert('Could not update like', (error as Error).message);
    },
  });

  const items = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.composer}>
        <TextInput
          value={composerText}
          onChangeText={setComposerText}
          placeholder="Share an update"
          style={styles.composerInput}
          multiline
        />
        {composerImage ? (
          <View style={styles.composerImageContainer}>
            <Image source={{ uri: composerImage.uri }} style={styles.composerImagePreview} />
            <Pressable style={styles.removeImageButton} onPress={() => setComposerImage(null)}>
              <Text style={styles.removeImageButtonText}>Remove image</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.composerActionsRow}>
          <Pressable style={styles.secondaryButton} onPress={pickComposerImage}>
            <Text style={styles.secondaryButtonText}>Attach image</Text>
          </Pressable>
        <Pressable
          style={styles.postButton}
          onPress={() => {
            createPostMutation.mutate();
          }}
          disabled={createPostMutation.isPending}
        >
          <Text style={styles.postButtonText}>{createPostMutation.isPending ? 'Posting...' : 'Post'}</Text>
        </Pressable>
        </View>
      </View>

      {feedQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0B6E4F" />
        </View>
      ) : (
        <FlatList<FeedPost>
          data={items}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.groupTargetSection}>
              <Text style={styles.groupTargetLabel}>Post target</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupChipsRow}>
                <Pressable
                  style={[styles.groupChip, !selectedGroupId ? styles.groupChipActive : null]}
                  onPress={() => setSelectedGroupId('')}
                >
                  <Text style={styles.groupChipText}>Global</Text>
                </Pressable>
                {(groupsQuery.data?.items ?? []).map((group) => (
                  <Pressable
                    key={group.id}
                    style={[styles.groupChip, selectedGroupId === group.id ? styles.groupChipActive : null]}
                    onPress={() => setSelectedGroupId(group.id)}
                  >
                    <Text style={styles.groupChipText}>{group.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() => {
                  navigation.navigate('UserProfile', { userId: item.author.id });
                }}
              >
                <Text style={styles.authorName}>{item.author.displayName}</Text>
              </Pressable>
              <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleString()}</Text>
              {item.groupId ? (
                <Text style={styles.groupBadgeText}>Group: {groupNameById[item.groupId] ?? 'Unknown group'}</Text>
              ) : (
                <Text style={styles.groupBadgeText}>Global post</Text>
              )}
              <Text style={styles.content}>{item.content}</Text>
              {item.media.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                  {item.media.map((mediaItem) => (
                    <Image key={mediaItem.id} source={{ uri: mediaItem.url }} style={styles.mediaImage} />
                  ))}
                </ScrollView>
              ) : null}
              <Text style={styles.stats}>
                {item.stats.likeCount} likes · {item.stats.commentCount} comments
              </Text>
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => toggleLikeMutation.mutate(item.id)}
                  disabled={toggleLikeMutation.isPending}
                >
                  <Text style={styles.actionButtonText}>
                    {likedByMeMap[item.id] ? 'Unlike' : 'Like'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.commentButton}
                  onPress={() =>
                    navigation.navigate('PostDetail', {
                      post: item,
                    })
                  }
                >
                  <Text style={styles.commentButtonText}>Comments</Text>
                </Pressable>
              </View>
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={feedQuery.isRefetching && !feedQuery.isFetchingNextPage}
              onRefresh={() => {
                feedQuery.refetch();
              }}
              tintColor="#0B6E4F"
            />
          }
          onEndReached={() => {
            if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) {
              feedQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            feedQuery.isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#0B6E4F" style={styles.footerSpinner} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.emptyText}>No posts in your feed yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  composer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  composerInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 60,
    backgroundColor: '#FFFFFF',
  },
  composerImageContainer: {
    gap: 8,
  },
  composerImagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  removeImageButton: {
    alignSelf: 'flex-start',
  },
  removeImageButtonText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  composerActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#0B6E4F',
    fontWeight: '700',
  },
  postButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#0B6E4F',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  postButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  timestamp: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
  },
  groupBadgeText: {
    marginTop: 6,
    color: '#0B6E4F',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    marginTop: 10,
    color: '#0F172A',
    lineHeight: 20,
  },
  mediaRow: {
    marginTop: 10,
    paddingRight: 8,
  },
  mediaImage: {
    width: 180,
    height: 140,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: '#E2E8F0',
  },
  stats: {
    marginTop: 10,
    color: '#475569',
    fontSize: 12,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  commentButton: {
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentButtonText: {
    color: '#0B6E4F',
    fontWeight: '700',
  },
  footerSpinner: {
    marginVertical: 14,
  },
  emptyText: {
    color: '#64748B',
  },
  groupTargetSection: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupTargetLabel: {
    color: '#334155',
    fontWeight: '700',
    marginBottom: 8,
  },
  groupChipsRow: {
    paddingRight: 8,
  },
  groupChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  groupChipActive: {
    borderColor: '#0B6E4F',
    backgroundColor: '#DCFCE7',
  },
  groupChipText: {
    color: '#0F172A',
    fontWeight: '600',
  },
});
