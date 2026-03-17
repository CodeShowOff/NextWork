import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { CommentItem, PaginatedComments, createComment, deleteComment, listComments } from '../../../shared/api/comments.api';
import {
  deletePost,
  FeedPost,
  getPostShareLink,
  PaginatedFeed,
  updatePost,
  votePostPoll,
} from '../../../shared/api/feed.api';
import { getLikeState, likePost, unlikePost } from '../../../shared/api/likes.api';
import { i18n } from '../../../shared/i18n/i18n';
import { useSessionStore } from '../../../shared/session/session.store';
import {
  adjustCommentCountInFeed,
  reconcileLikeCountInFeed,
  removePostFromFeed,
  reconcilePollInFeed,
  updatePostInFeed,
} from '../engagement-cache';
import { FeedStackParamList } from './FeedStack';

type Props = NativeStackScreenProps<FeedStackParamList, 'PostDetail'>;

const pageSize = 30;

function mergeCommentIntoFirstPage(
  current: InfiniteData<PaginatedComments> | undefined,
  comment: CommentItem,
): InfiniteData<PaginatedComments> | undefined {
  if (!current) {
    return current;
  }

  if (current.pages.length === 0) {
    return {
      pageParams: [undefined],
      pages: [{ items: [comment], nextCursor: null }],
    };
  }

  const first = current.pages[0];
  return {
    ...current,
    pages: [{ ...first, items: [comment, ...first.items] }, ...current.pages.slice(1)],
  };
}

function removeCommentFromPages(
  current: InfiniteData<PaginatedComments> | undefined,
  commentId: string,
): InfiniteData<PaginatedComments> | undefined {
  if (!current) {
    return current;
  }

  return {
    pageParams: current.pageParams,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== commentId),
    })),
  };
}

export function PostDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { post } = route.params;
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.userId);
  const [postState, setPostState] = useState(post);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);
  const [likedByMe, setLikedByMe] = useState<boolean | null>(null);
  const [likeCount, setLikeCount] = useState(postState.stats.likeCount);
  const [commentCount, setCommentCount] = useState(postState.stats.commentCount);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editingPostContent, setEditingPostContent] = useState(postState.content);

  const commentsQuery = useInfiniteQuery({
    queryKey: ['comments', postState.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listComments(postState.id, { limit: pageSize, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      let nextLikeState = likedByMe;
      if (nextLikeState === null) {
        const state = await getLikeState(postState.id);
        nextLikeState = state.likedByMe;
      }

      if (nextLikeState) {
        return unlikePost(postState.id);
      }

      return likePost(postState.id);
    },
    onSuccess: (result) => {
      setLikedByMe(result.liked);
      setLikeCount(result.likeCount);
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        reconcileLikeCountInFeed(current, {
          postId: postState.id,
          likeCount: result.likeCount,
        }),
      );
    },
    onError: (error) => {
      Alert.alert(t('feed.alerts.updateLikeFailedTitle'), (error as Error).message);
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (payload: { body: string; parentCommentId?: string }) =>
      createComment({
        postId: postState.id,
        body: payload.body,
        ...(payload.parentCommentId ? { parentCommentId: payload.parentCommentId } : {}),
      }),
    onSuccess: (comment) => {
      setCommentText('');
      setReplyingTo(null);
      setCommentCount((count: number) => count + 1);
      queryClient.setQueryData<InfiniteData<PaginatedComments>>(
        ['comments', postState.id],
        (current) => mergeCommentIntoFirstPage(current, comment),
      );
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        adjustCommentCountInFeed(current, {
          postId: postState.id,
          delta: 1,
        }),
      );
    },
    onError: (error) => {
      Alert.alert(t('feed.detail.alerts.createCommentFailed'), (error as Error).message);
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await deleteComment(commentId);
      return commentId;
    },
    onSuccess: (commentId) => {
      setCommentCount((count: number) => Math.max(0, count - 1));
      if (replyingTo?.id === commentId) {
        setReplyingTo(null);
      }
      queryClient.setQueryData<InfiniteData<PaginatedComments>>(
        ['comments', postState.id],
        (current) => removeCommentFromPages(current, commentId),
      );
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        adjustCommentCountInFeed(current, {
          postId: postState.id,
          delta: -1,
        }),
      );
    },
    onError: (error) => {
      Alert.alert(t('feed.detail.alerts.deleteCommentFailed'), (error as Error).message);
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async (content: string) => updatePost(postState.id, { content }),
    onSuccess: (updated) => {
      setPostState(updated);
      setEditingPostContent(updated.content);
      setIsEditingPost(false);
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
    mutationFn: async () => {
      await deletePost(postState.id);
    },
    onSuccess: () => {
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        removePostFromFeed(current, postState.id),
      );
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert(t('feed.alerts.deletePostFailedTitle'), (error as Error).message);
    },
  });

  const sharePostMutation = useMutation({
    mutationFn: async () => {
      const shareLink = await getPostShareLink(postState.id);
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
    mutationFn: async (optionId: string) => votePostPoll(postState.id, optionId),
    onSuccess: (updated) => {
      setPostState(updated);
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

  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [commentsQuery.data],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.postCard}>
        <Text style={styles.authorName}>{postState.author.displayName}</Text>
        <Text style={styles.timestamp}>
          {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(postState.createdAt),
          )}
        </Text>
        {isEditingPost ? (
          <View style={styles.editSection}>
            <TextInput
              value={editingPostContent}
              onChangeText={setEditingPostContent}
              style={styles.editInput}
              multiline
            />
            <View style={styles.editActionsRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setIsEditingPost(false);
                  setEditingPostContent(postState.content);
                }}
              >
                <Text style={styles.secondaryButtonText}>{t('common.actions.cancel')}</Text>
              </Pressable>
              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  const content = editingPostContent.trim();
                  if (!content) {
                    return;
                  }

                  updatePostMutation.mutate(content);
                }}
                disabled={updatePostMutation.isPending}
              >
                <Text style={styles.actionButtonText}>{t('common.actions.save')}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.content}>{postState.content}</Text>
        )}
        {postState.hashtags.length ? (
          <Text style={styles.hashtagsText}>{postState.hashtags.join(' ')}</Text>
        ) : null}
        {postState.poll ? (
          <View style={styles.pollCard}>
            <Text style={styles.pollQuestion}>{postState.poll.question}</Text>
            {(postState.poll.options as Array<{ id: string; text: string; voteCount: number }>).map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.pollOptionButton,
                  postState.poll?.votedOptionId === option.id ? styles.pollOptionButtonActive : null,
                ]}
                onPress={() => votePollMutation.mutate(option.id)}
                disabled={votePollMutation.isPending}
              >
                <Text style={styles.pollOptionText}>{option.text}</Text>
                <Text style={styles.pollOptionVotes}>{option.voteCount}</Text>
              </Pressable>
            ))}
            <Text style={styles.pollTotalVotes}>{t('feed.poll.totalVotes', { count: postState.poll.totalVotes })}</Text>
          </View>
        ) : null}
        {postState.media.length ? (
          <View style={styles.mediaColumn}>
            {postState.media.map((mediaItem: FeedPost['media'][number]) => (
              <Image key={mediaItem.id} source={{ uri: mediaItem.url }} style={styles.mediaImage} />
            ))}
          </View>
        ) : null}
        <View style={styles.engagementRow}>
          <Pressable
            style={[styles.actionButton, likeMutation.isPending ? styles.actionButtonDisabled : null]}
            onPress={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
          >
            <Text style={styles.actionButtonText}>
              {likedByMe ? t('feed.actions.unlike') : t('feed.actions.like')} ({likeCount})
            </Text>
          </Pressable>
          <Text style={styles.commentCountLabel}>{t('feed.detail.commentCount', { count: commentCount })}</Text>
        </View>
        <View style={styles.postActionsRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => sharePostMutation.mutate()}
            disabled={sharePostMutation.isPending}
          >
            <Text style={styles.secondaryButtonText}>{t('common.actions.share')}</Text>
          </Pressable>
          {postState.authorId === currentUserId ? (
            <>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setIsEditingPost((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={t('feed.actions.edit')}
              >
                <Text style={styles.secondaryButtonText}>{t('feed.actions.edit')}</Text>
              </Pressable>
              <Pressable
                style={styles.destructiveButton}
                onPress={() => {
                  Alert.alert(t('feed.alerts.deletePostConfirmTitle'), t('feed.alerts.deletePostConfirmBody'), [
                    { text: t('common.actions.cancel'), style: 'cancel' },
                    {
                      text: t('common.actions.delete'),
                      style: 'destructive',
                      onPress: () => deletePostMutation.mutate(),
                    },
                  ]);
                }}
                disabled={deletePostMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('feed.actions.delete')}
              >
                <Text style={styles.destructiveButtonText}>{t('feed.actions.delete')}</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      {commentsQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0B6E4F" />
        </View>
      ) : (
        <FlatList<CommentItem>
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.commentAuthor}>{item.author.displayName}</Text>
                <Text style={styles.commentTime}>
                  {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(item.createdAt),
                  )}
                </Text>
              </View>
              <Text style={styles.commentBody}>{item.body}</Text>
              <Pressable
                style={styles.replyLinkButton}
                onPress={() => setReplyingTo(item)}
                disabled={createCommentMutation.isPending}
              >
                <Text style={styles.replyLinkText}>{t('feed.detail.actions.reply')}</Text>
              </Pressable>
              {item.author.id === currentUserId ? (
                <Pressable
                  style={styles.deleteLinkButton}
                  onPress={() => deleteCommentMutation.mutate(item.id)}
                  disabled={deleteCommentMutation.isPending}
                >
                  <Text style={styles.deleteLinkText}>{t('feed.detail.actions.delete')}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          onEndReached={() => {
            if (commentsQuery.hasNextPage && !commentsQuery.isFetchingNextPage) {
              commentsQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            commentsQuery.isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#0B6E4F" style={styles.footerSpinner} />
            ) : null
          }
          ListEmptyComponent={<Text style={styles.emptyText}>{t('feed.detail.emptyComments')}</Text>}
        />
      )}

      <View style={styles.commentComposer}>
        {replyingTo ? (
          <View style={styles.replyContextRow}>
            <Text style={styles.replyContextText}>{t('feed.detail.replyingTo', { name: replyingTo.author.displayName })}</Text>
            <Pressable style={styles.replyCancelButton} onPress={() => setReplyingTo(null)}>
              <Text style={styles.replyCancelText}>{t('common.actions.cancel')}</Text>
            </Pressable>
          </View>
        ) : null}
        <TextInput
          value={commentText}
          onChangeText={setCommentText}
          placeholder={
            replyingTo
              ? t('feed.detail.replyToPlaceholder', { name: replyingTo.author.displayName })
              : t('feed.detail.writeCommentPlaceholder')
          }
          style={styles.commentInput}
          multiline
        />
        <Pressable
          style={styles.sendButton}
          onPress={() => {
            const body = commentText.trim();
            if (!body) {
              return;
            }

            createCommentMutation.mutate({
              body,
              ...(replyingTo ? { parentCommentId: replyingTo.id } : {}),
            });
          }}
          disabled={createCommentMutation.isPending}
        >
          <Text style={styles.sendButtonText}>{t('feed.detail.actions.send')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    margin: 12,
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
  content: {
    marginTop: 10,
    color: '#0F172A',
    lineHeight: 20,
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
    marginTop: 10,
    gap: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 50,
    backgroundColor: '#FFFFFF',
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  mediaColumn: {
    marginTop: 10,
    gap: 8,
  },
  mediaImage: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  engagementRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  commentCountLabel: {
    color: '#475569',
    fontSize: 12,
  },
  postActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
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
  destructiveButton: {
    borderWidth: 1,
    borderColor: '#B91C1C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  destructiveButtonText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  commentCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    color: '#0F172A',
    fontWeight: '700',
  },
  commentTime: {
    color: '#64748B',
    fontSize: 12,
  },
  commentBody: {
    marginTop: 6,
    color: '#0F172A',
    lineHeight: 20,
  },
  deleteLinkButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  replyLinkButton: {
    alignSelf: 'flex-end',
    marginTop: 6,
  },
  replyLinkText: {
    color: '#0B6E4F',
    fontWeight: '700',
    fontSize: 12,
  },
  deleteLinkText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  footerSpinner: {
    marginVertical: 10,
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    marginVertical: 16,
  },
  commentComposer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 10,
    gap: 8,
  },
  replyContextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  replyContextText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 12,
  },
  replyCancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  replyCancelText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 12,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    maxHeight: 110,
  },
  sendButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
