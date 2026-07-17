import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageSourcePropType,
  Share,
  ScrollView,
  RefreshControl,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

import {
  createPost,
  deletePost,
  FeedPost,
  getPostShareLink,
  listFeed,
  PaginatedFeed,
  updatePost,
  votePostPoll,
} from '../../shared/api/feed.api';
import { listGroups } from '../../shared/api/groups.api';
import { getLikeState, likePost, unlikePost } from '../../shared/api/likes.api';
import { uploadImageWithContract } from '../../shared/api/media.api';
import { listMyOrganizations } from '../../shared/api/organizations.api';
import { searchAll, SearchUserItem } from '../../shared/api/search.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { i18n } from '../../shared/i18n/i18n';
import { featureFlags } from '../../shared/config/runtime';
import { FeedStackParamList } from './screens/FeedStack';
import {
  applyOptimisticLikeToFeed,
  reconcileLikeCountInFeed,
  removePostFromFeed,
  reconcilePollInFeed,
  updatePostInFeed,
} from './engagement-cache';
import { canOpenLikerList } from './likers-list.logic';

const pageSize = 20;

const groupArtworkByKeyword: { keyword: string; source: ImageSourcePropType }[] = [
  { keyword: 'announcement', source: require('../../../assets/images/group_company_announcements.jpg') },
  { keyword: 'marketing', source: require('../../../assets/images/group_marketing_team.jpg') },
  { keyword: 'project', source: require('../../../assets/images/group_project_updates.jpg') },
  { keyword: 'general', source: require('../../../assets/images/group_general.jpg') },
  { keyword: 'social', source: require('../../../assets/images/group_company_social.jpg') },
];

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [composerText, setComposerText] = useState('');
  const [composerImage, setComposerImage] = useState<ComposerImage | null>(null);
  const [likedByMeMap, setLikedByMeMap] = useState<Record<string, boolean>>({});
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [selectedTaggedUsers, setSelectedTaggedUsers] = useState<SearchUserItem[]>([]);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [debouncedTagSearch, setDebouncedTagSearch] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [composerValidationMessage, setComposerValidationMessage] = useState('');
  const [showTagComposer, setShowTagComposer] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedTagSearch(tagSearchInput.trim());
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [tagSearchInput]);

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

  const tagSearchQuery = useQuery({
    queryKey: ['feed', 'tag-search', debouncedTagSearch],
    queryFn: () => searchAll({ query: debouncedTagSearch, limit: 8 }),
    enabled: debouncedTagSearch.length >= 2,
  });

  const availableTagUsers = useMemo(() => {
    const users = tagSearchQuery.data?.users ?? [];
    const selectedIds = new Set(selectedTaggedUsers.map((user) => user.id));
    return users.filter((user) => !selectedIds.has(user.id));
  }, [selectedTaggedUsers, tagSearchQuery.data?.users]);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const content = composerText.trim();
      if (!content) {
        throw new Error(t('feed.alerts.writeBeforePosting'));
      }

      const normalizedPollOptions = pollOptions.map((value) => value.trim()).filter(Boolean);
      const hasPollInput = Boolean(pollQuestion.trim()) || normalizedPollOptions.length > 0;
      const pollPayload = hasPollInput
        ? (() => {
            if (!pollQuestion.trim()) {
              throw new Error(t('feed.poll.validations.questionRequired'));
            }
            if (normalizedPollOptions.length < 2) {
              throw new Error(t('feed.poll.validations.minOptions'));
            }
            if (normalizedPollOptions.length > 6) {
              throw new Error(t('feed.poll.validations.maxOptions'));
            }

            const lowered = normalizedPollOptions.map((option) => option.toLowerCase());
            if (new Set(lowered).size !== lowered.length) {
              throw new Error(t('feed.poll.validations.uniqueOptions'));
            }

            return {
              question: pollQuestion.trim(),
              options: normalizedPollOptions.map((text) => ({ text })),
            };
          })()
        : undefined;

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
        ...(selectedTaggedUsers.length
          ? {
              taggedUserIds: selectedTaggedUsers.map((user) => user.id),
            }
          : {}),
        ...(pollPayload ? { poll: pollPayload } : {}),
        ...(mediaPayload ? { media: mediaPayload } : {}),
      });
    },
    onSuccess: (created) => {
      setComposerValidationMessage('');
      setComposerText('');
      setComposerImage(null);
      setSelectedTaggedUsers([]);
      setTagSearchInput('');
      setDebouncedTagSearch('');
      setPollQuestion('');
      setPollOptions(['', '']);
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
      setComposerValidationMessage((error as Error).message);
    },
  });

  const setPollOptionAt = (index: number, value: string) => {
    setPollOptions((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };

  const addPollOption = () => {
    setPollOptions((current) => {
      if (current.length >= 6) {
        setComposerValidationMessage(t('feed.poll.validations.addLimit'));
        return current;
      }
      setComposerValidationMessage('');
      return [...current, ''];
    });
  };

  const removePollOption = (index: number) => {
    setPollOptions((current) => {
      if (current.length <= 2) {
        setComposerValidationMessage(t('feed.poll.validations.removeMin'));
        return current;
      }
      setComposerValidationMessage('');
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const addTaggedUser = (user: SearchUserItem) => {
    setSelectedTaggedUsers((current) => [...current, user]);
    setTagSearchInput('');
    setDebouncedTagSearch('');
  };

  const removeTaggedUser = (userId: string) => {
    setSelectedTaggedUsers((current) => current.filter((user) => user.id !== userId));
  };

  async function pickComposerImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('feed.alerts.permissionRequiredTitle'), t('feed.alerts.permissionRequiredBody'));
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
        Alert.alert(t('feed.alerts.updateLikeFailedTitle'), (error as Error).message);
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

      Alert.alert(t('feed.alerts.updateLikeFailedTitle'), (error as Error).message);
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async (params: { postId: string; content: string }) =>
      updatePost(params.postId, { content: params.content }),
    onSuccess: (updated) => {
      setEditingPostId(null);
      setEditingContent('');
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        updatePostInFeed(current, {
          postId: updated.id,
          content: updated.content,
          updatedAt: updated.updatedAt,
        }),
      );
    },
    onError: (error) => {
      Alert.alert(t('feed.alerts.updatePostFailedTitle'), (error as Error).message);
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      await deletePost(postId);
      return postId;
    },
    onSuccess: (postId) => {
      if (editingPostId === postId) {
        setEditingPostId(null);
        setEditingContent('');
      }

      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        removePostFromFeed(current, postId),
      );
    },
    onError: (error) => {
      Alert.alert(t('feed.alerts.deletePostFailedTitle'), (error as Error).message);
    },
  });

  const sharePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const shareLink = await getPostShareLink(postId);
      await Share.share({
        message: shareLink.shareUrl,
        url: shareLink.shareUrl,
      });
    },
    onError: (error) => {
      Alert.alert(t('feed.alerts.sharePostFailedTitle'), (error as Error).message);
    },
  });

  const votePollMutation = useMutation({
    mutationFn: async (params: { postId: string; optionId: string }) =>
      votePostPoll(params.postId, params.optionId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        reconcilePollInFeed(current, {
          postId: updated.id,
          poll: updated.poll,
        }),
      );
    },
    onError: (error) => {
      Alert.alert(t('feed.alerts.votePollFailedTitle'), (error as Error).message);
    },
  });

  const items = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );
  const FeedListComponent = featureFlags.flashListRendering ? FlashList : FlatList;
  const keyExtractor = useCallback((item: FeedPost) => item.id, []);
  const likedStateSignature = useMemo(
    () =>
      Object.entries(likedByMeMap)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, liked]) => `${id}:${liked ? 1 : 0}`)
        .join('|'),
    [likedByMeMap],
  );
  const groupTilePalette = useMemo(
    () => ['#4338CA', '#FACC15', '#FF5A4A', '#F3C5CF', '#E5D4C5'],
    [],
  );
  const groupTileIcons = useMemo<(keyof typeof MaterialIcons.glyphMap)[]>(
    () => ['star', 'back-hand', 'bolt', 'add-comment', 'public'],
    [],
  );
  const feedListHeader = useMemo(
    () => (
      <View style={styles.groupTargetSection}>
        <Text style={styles.groupTargetLabel}>{t('groups.title.yourGroups')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupTilesRow}>
          {(groupsQuery.data?.items ?? []).slice(0, 6).map((group, index) => {
            const tileColor = groupTilePalette[index % groupTilePalette.length];
            const iconName = groupTileIcons[index % groupTileIcons.length];
            const isActive = selectedGroupId === group.id;
            return (
              <Pressable
                key={group.id}
                style={styles.groupTileWrap}
                onPress={() => setSelectedGroupId((current) => (current === group.id ? '' : group.id))}
              >
                <View
                  style={[
                    styles.groupTile,
                    { backgroundColor: tileColor },
                    isActive ? styles.groupTileActive : null,
                  ]}
                >
                  <MaterialIcons name={iconName} size={25} color={tileColor === '#FACC15' ? '#111827' : '#FFFFFF'} />
                </View>
                <Text numberOfLines={2} style={styles.groupTileLabel}>
                  {group.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    ),
    [groupTileIcons, groupTilePalette, groupsQuery.data?.items, selectedGroupId, t],
  );

  const hasPollDraft = useMemo(
    () => Boolean(pollQuestion.trim()) || pollOptions.some((option) => option.trim().length > 0),
    [pollOptions, pollQuestion],
  );

  const resolveGroupArtwork = useCallback(
    (groupId: string | null): ImageSourcePropType | null => {
      if (!groupId) {
        return null;
      }

      const groupName = (groupNameById[groupId] ?? '').toLowerCase();
      for (const artwork of groupArtworkByKeyword) {
        if (groupName.includes(artwork.keyword)) {
          return artwork.source;
        }
      }

      return require('../../../assets/images/group_general.jpg');
    },
    [groupNameById],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.composer}>
        <View style={styles.composerTopRow}>
          <View style={styles.composerAvatarCircle}>
            <Text style={styles.composerAvatarText}>{(meQuery.data?.id ?? 'U').slice(0, 1).toUpperCase()}</Text>
          </View>
          <TextInput
            value={composerText}
            onChangeText={setComposerText}
            placeholder={t('feed.composer.placeholder')}
            style={styles.composerInput}
            multiline
            accessibilityLabel={t('feed.composer.placeholder')}
          />
        </View>

        <View style={styles.composerQuickActionsRow}>
          <Pressable
            style={styles.quickActionChip}
            onPress={pickComposerImage}
            accessibilityRole="button"
            accessibilityLabel={t('feed.composer.attachImage')}
          >
            <MaterialIcons name="photo" size={20} color="#16A34A" />
            <Text style={styles.quickActionText}>Photo</Text>
          </Pressable>
          <Pressable
            style={[styles.quickActionChip, showTagComposer ? styles.quickActionChipActive : null]}
            onPress={() => setShowTagComposer((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={t('feed.composer.tagPeople')}
          >
            <MaterialIcons name="videocam" size={20} color="#EF4444" />
            <Text style={styles.quickActionText}>Live</Text>
          </Pressable>
          <Pressable
            style={[styles.quickActionChip, showPollComposer ? styles.quickActionChipActive : null]}
            onPress={() => setShowPollComposer((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={t('feed.composer.pollOptional')}
          >
            <MaterialIcons name="poll" size={20} color="#111827" />
            <Text style={styles.quickActionText}>Poll</Text>
          </Pressable>
          <Pressable
            style={styles.postButton}
            onPress={() => {
              createPostMutation.mutate();
            }}
            disabled={createPostMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('feed.composer.post')}
          >
            <Text style={styles.postButtonText}>
              {createPostMutation.isPending ? t('feed.composer.posting') : t('feed.composer.post')}
            </Text>
          </Pressable>
        </View>

        {composerImage ? (
          <View style={styles.composerImageContainer}>
            <Image source={{ uri: composerImage.uri }} style={styles.composerImagePreview} />
            <Pressable
              style={styles.removeImageButton}
              onPress={() => setComposerImage(null)}
              accessibilityRole="button"
              accessibilityLabel={t('feed.composer.removeImage')}
            >
              <Text style={styles.removeImageButtonText}>{t('feed.composer.removeImage')}</Text>
            </Pressable>
          </View>
        ) : null}
        {(showTagComposer || selectedTaggedUsers.length > 0 || tagSearchInput.trim().length > 0) ? (
          <View style={styles.composerSectionCard}>
            <Text style={styles.metaSectionLabel}>{t('feed.composer.tagPeople')}</Text>
            {selectedTaggedUsers.length ? (
              <View style={styles.taggedUsersWrap}>
                {selectedTaggedUsers.map((user) => (
                  <Pressable
                    key={user.id}
                    style={styles.taggedUserChip}
                    onPress={() => removeTaggedUser(user.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t('common.actions.remove')} ${user.displayName}`}
                  >
                    <Text style={styles.taggedUserChipText}>{user.displayName} x</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <TextInput
              value={tagSearchInput}
              onChangeText={setTagSearchInput}
              placeholder={t('feed.composer.searchPeopleToTag')}
              style={styles.metaInput}
              autoCapitalize="none"
              accessibilityLabel={t('feed.composer.searchPeopleToTag')}
            />
            {tagSearchQuery.isFetching ? <ActivityIndicator size="small" color="#3B82F6" /> : null}
            {availableTagUsers.length ? (
              <View style={styles.tagResultsList}>
                {availableTagUsers.map((user) => (
                  <Pressable key={user.id} style={styles.tagResultItem} onPress={() => addTaggedUser(user)}>
                    <Text style={styles.tagResultName}>{user.displayName}</Text>
                    <Text style={styles.tagResultMeta}>{user.email}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {(showPollComposer || hasPollDraft) ? (
          <View style={styles.composerSectionCard}>
            <Text style={styles.metaSectionLabel}>{t('feed.composer.pollOptional')}</Text>
            <TextInput
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder={t('feed.composer.pollQuestionOptional')}
              style={styles.metaInput}
              accessibilityLabel={t('feed.composer.pollQuestionOptional')}
            />
            {pollOptions.map((option, index) => (
              <View key={`poll-option-${index}`} style={styles.pollOptionRow}>
                <TextInput
                  value={option}
                  onChangeText={(value) => setPollOptionAt(index, value)}
                  placeholder={t('feed.composer.pollOptionPlaceholder', { index: index + 1 })}
                  style={[styles.metaInput, styles.pollOptionInput]}
                  accessibilityLabel={t('feed.composer.pollOptionPlaceholder', { index: index + 1 })}
                />
                <Pressable
                  style={styles.pollOptionRemoveButton}
                  onPress={() => removePollOption(index)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.actions.remove')}
                >
                  <Text style={styles.pollOptionRemoveText}>{t('common.actions.remove')}</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.secondaryButton}
              onPress={addPollOption}
              accessibilityRole="button"
              accessibilityLabel={t('feed.composer.addOption')}
            >
              <Text style={styles.secondaryButtonText}>{t('feed.composer.addOption')}</Text>
            </Pressable>
          </View>
        ) : null}

        {composerValidationMessage ? (
          <Text style={styles.validationMessage}>{composerValidationMessage}</Text>
        ) : null}
      </View>

      {feedQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0B6E4F" />
        </View>
      ) : (
        <FeedListComponent<FeedPost>
          data={items}
          keyExtractor={keyExtractor}
          extraData={`${likedStateSignature}|${editingPostId ?? ''}|${editingContent}|${selectedGroupId}|${meQuery.data?.id ?? ''}`}
          ListHeaderComponent={feedListHeader}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardAvatarCircle}>
                  {item.groupId && resolveGroupArtwork(item.groupId) ? (
                    <Image source={resolveGroupArtwork(item.groupId) as ImageSourcePropType} style={styles.cardAvatarImage} />
                  ) : (
                    <Text style={styles.cardAvatarText}>{item.author.displayName.slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.cardHeaderTextColumn}>
                  <Pressable
                    onPress={() => {
                      navigation.navigate('UserProfile', { userId: item.author.id });
                    }}
                  >
                    <Text style={styles.authorName}>{item.author.displayName}</Text>
                  </Pressable>
                  <Text style={styles.timestamp}>
                    {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
                      new Date(item.createdAt),
                    )}
                  </Text>
                  {item.groupId ? (
                    <Text style={styles.groupBadgeText}>
                      {t('feed.targeting.groupLabel', {
                        groupName: groupNameById[item.groupId] ?? t('feed.targeting.unknownGroup'),
                      })}
                    </Text>
                  ) : (
                    <Text style={styles.groupBadgeText}>{t('feed.targeting.globalPost')}</Text>
                  )}
                </View>
                <MaterialIcons name="more-horiz" size={24} color="#9CA3AF" />
              </View>
              {editingPostId === item.id ? (
                <View style={styles.editSection}>
                  <TextInput
                    value={editingContent}
                    onChangeText={setEditingContent}
                    style={styles.editInput}
                    multiline
                  />
                  <View style={styles.editActionsRow}>
                    <Pressable
                      style={styles.commentButton}
                      onPress={() => {
                        setEditingPostId(null);
                        setEditingContent('');
                      }}
                    >
                      <Text style={styles.commentButtonText}>{t('common.actions.cancel')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => {
                        const nextContent = editingContent.trim();
                        if (!nextContent) {
                          return;
                        }

                        updatePostMutation.mutate({
                          postId: item.id,
                          content: nextContent,
                        });
                      }}
                      disabled={updatePostMutation.isPending}
                    >
                      <Text style={styles.actionButtonText}>{t('common.actions.save')}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Text style={styles.content}>{item.content}</Text>
              )}
              {item.hashtags.length ? (
                <Text style={styles.hashtagsText}>{item.hashtags.join(' ')}</Text>
              ) : null}
              {item.poll ? (
                <View style={styles.pollCard}>
                  <Text style={styles.pollQuestion}>{item.poll.question}</Text>
                  {item.poll.options.map((option) => (
                    <Pressable
                      key={option.id}
                      style={[
                        styles.pollOptionButton,
                        item.poll?.votedOptionId === option.id ? styles.pollOptionButtonActive : null,
                      ]}
                      onPress={() => votePollMutation.mutate({ postId: item.id, optionId: option.id })}
                      disabled={votePollMutation.isPending}
                    >
                      <Text style={styles.pollOptionText}>{option.text}</Text>
                      <Text style={styles.pollOptionVotes}>{option.voteCount}</Text>
                    </Pressable>
                  ))}
                      <Text style={styles.pollTotalVotes}>
                        {t('feed.poll.totalVotes', { count: item.poll.totalVotes })}
                      </Text>
                </View>
              ) : null}
              {item.media.length ? (
                <>
                  <View style={styles.liveMetaRow}>
                    <Text style={styles.liveBadgeText}>LIVE</Text>
                    <View style={styles.liveViewersPill}>
                      <MaterialIcons name="visibility" size={15} color="#FFFFFF" />
                      <Text style={styles.liveViewersText}>{(item.stats.likeCount * 125).toLocaleString()}</Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                    {item.media.map((mediaItem) => (
                      <Image key={mediaItem.id} source={{ uri: mediaItem.url }} style={styles.mediaImage} />
                    ))}
                  </ScrollView>
                </>
              ) : null}
              <Text style={styles.stats}>
                {t('feed.stats', {
                  likes: item.stats.likeCount,
                  comments: item.stats.commentCount,
                })}
              </Text>
              <View style={styles.actionsRow}>
                <Pressable
                  style={styles.feedActionChipPrimary}
                  onPress={() => toggleLikeMutation.mutate(item.id)}
                  disabled={toggleLikeMutation.isPending}
                >
                  <MaterialIcons
                    name={likedByMeMap[item.id] ? 'thumb-up' : 'thumb-up-off-alt'}
                    size={20}
                    color={likedByMeMap[item.id] ? '#2563EB' : '#9CA3AF'}
                  />
                  <Text style={styles.feedActionChipText}>
                    {likedByMeMap[item.id] ? t('feed.actions.unlike') : t('feed.actions.like')}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.feedActionChipPrimary}
                  onPress={() =>
                    navigation.navigate('PostDetail', {
                      post: item,
                    })
                  }
                >
                  <MaterialIcons name="chat-bubble-outline" size={20} color="#9CA3AF" />
                  <Text style={styles.feedActionChipText}>{t('feed.actions.comments')}</Text>
                </Pressable>
                <Pressable
                  style={styles.feedActionChipPrimary}
                  onPress={() => sharePostMutation.mutate(item.id)}
                  disabled={sharePostMutation.isPending}
                >
                  <MaterialIcons name="share" size={20} color="#9CA3AF" />
                  <Text style={styles.feedActionChipText}>{t('common.actions.share')}</Text>
                </Pressable>
              </View>
              <View style={styles.actionsRowSecondary}>
                <Pressable
                  style={[styles.commentButton, !canOpenLikerList(item.stats.likeCount) ? styles.commentButtonDisabled : null]}
                  onPress={() =>
                    navigation.navigate('LikerList', {
                      postId: item.id,
                      title: `${t('feed.actions.like')} (${item.stats.likeCount})`,
                    })
                  }
                  disabled={!canOpenLikerList(item.stats.likeCount)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('feed.actions.like')} (${item.stats.likeCount})`}
                >
                  <Text
                    style={[
                      styles.commentButtonText,
                      !canOpenLikerList(item.stats.likeCount) ? styles.commentButtonTextDisabled : null,
                    ]}
                  >
                    {t('feed.actions.like')} ({item.stats.likeCount})
                  </Text>
                </Pressable>
                {item.authorId === meQuery.data?.id ? (
                  <>
                    <Pressable
                      style={styles.commentButton}
                      onPress={() => {
                        setEditingPostId(item.id);
                        setEditingContent(item.content);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('feed.actions.edit')}
                    >
                      <Text style={styles.commentButtonText}>{t('feed.actions.edit')}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.dangerButton}
                      onPress={() => {
                        Alert.alert(t('feed.alerts.deletePostConfirmTitle'), t('feed.alerts.deletePostConfirmBody'), [
                          { text: t('common.actions.cancel'), style: 'cancel' },
                          {
                            text: t('common.actions.delete'),
                            style: 'destructive',
                            onPress: () => deletePostMutation.mutate(item.id),
                          },
                        ]);
                      }}
                      disabled={deletePostMutation.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={t('feed.actions.delete')}
                    >
                      <Text style={styles.dangerButtonText}>{t('feed.actions.delete')}</Text>
                    </Pressable>
                  </>
                ) : null}
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
              <Text style={styles.emptyText}>{t('feed.empty.noPosts')}</Text>
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
    backgroundColor: '#ECECEC',
  },
  composer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    padding: 14,
    gap: 10,
  },
  composerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BFDBFE',
  },
  composerAvatarText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 22,
  },
  composerInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 46,
    flex: 1,
    backgroundColor: '#F3F4F6',
    fontSize: 14,
  },
  composerQuickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickActionChip: {
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickActionChipActive: {
    backgroundColor: '#E0E7FF',
  },
  quickActionText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
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
  composerSectionCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
  },
  metaInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#F9FAFB',
    fontSize: 14,
  },
  metaSectionLabel: {
    color: '#334155',
    fontWeight: '700',
    marginTop: 4,
  },
  taggedUsersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  taggedUserChip: {
    borderWidth: 1,
    borderColor: '#0B6E4F',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#DCFCE7',
  },
  taggedUserChipText: {
    color: '#166534',
    fontWeight: '700',
  },
  tagResultsList: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  tagResultItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tagResultName: {
    color: '#0F172A',
    fontWeight: '700',
  },
  tagResultMeta: {
    color: '#64748B',
    fontSize: 12,
  },
  pollOptionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pollOptionInput: {
    flex: 1,
  },
  pollOptionRemoveButton: {
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pollOptionRemoveText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  validationMessage: {
    color: '#B91C1C',
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  postButton: {
    backgroundColor: '#1877F2',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
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
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  cardAvatarText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 19,
  },
  cardHeaderTextColumn: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  timestamp: {
    marginTop: 2,
    color: '#9CA3AF',
    fontSize: 12,
  },
  groupBadgeText: {
    marginTop: 3,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    marginTop: 10,
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
  },
  hashtagsText: {
    marginTop: 6,
    color: '#0369A1',
    fontWeight: '600',
  },
  pollCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    backgroundColor: '#F8FAFC',
  },
  pollQuestion: {
    color: '#0F172A',
    fontWeight: '700',
  },
  pollOptionButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  pollOptionButtonActive: {
    borderColor: '#0B6E4F',
    backgroundColor: '#DCFCE7',
  },
  pollOptionText: {
    color: '#0F172A',
    fontWeight: '600',
  },
  pollOptionVotes: {
    color: '#334155',
    fontWeight: '700',
  },
  pollTotalVotes: {
    color: '#475569',
    fontSize: 12,
  },
  editSection: {
    marginTop: 8,
    gap: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    backgroundColor: '#FFFFFF',
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  mediaRow: {
    marginTop: 8,
    paddingRight: 8,
  },
  liveMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadgeText: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveViewersPill: {
    backgroundColor: '#6B7280',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveViewersText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  mediaImage: {
    width: 180,
    height: 150,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#E2E8F0',
  },
  stats: {
    marginTop: 10,
    color: '#475569',
    fontSize: 13,
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  feedActionChipPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  feedActionChipText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },
  actionsRowSecondary: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
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
  commentButtonDisabled: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  commentButtonText: {
    color: '#0B6E4F',
    fontWeight: '700',
  },
  commentButtonTextDisabled: {
    color: '#94A3B8',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dangerButtonText: {
    color: '#B91C1C',
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
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  groupTargetLabel: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 10,
  },
  groupTilesRow: {
    paddingRight: 10,
    gap: 12,
  },
  groupTileWrap: {
    width: 86,
    alignItems: 'center',
  },
  groupTile: {
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTileActive: {
    borderWidth: 3,
    borderColor: '#BFDBFE',
  },
  groupTileLabel: {
    marginTop: 8,
    color: '#111827',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
});
