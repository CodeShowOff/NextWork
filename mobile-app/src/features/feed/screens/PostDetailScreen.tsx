import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { CommentItem, PaginatedComments, createComment, deleteComment, listComments } from '../../../shared/api/comments.api';
import { FeedPost, PaginatedFeed } from '../../../shared/api/feed.api';
import { getLikeState, likePost, unlikePost } from '../../../shared/api/likes.api';
import { useSessionStore } from '../../../shared/session/session.store';
import { adjustCommentCountInFeed, reconcileLikeCountInFeed } from '../engagement-cache';
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

export function PostDetailScreen({ route }: Props) {
  const { post } = route.params;
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.userId);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);
  const [likedByMe, setLikedByMe] = useState<boolean | null>(null);
  const [likeCount, setLikeCount] = useState(post.stats.likeCount);
  const [commentCount, setCommentCount] = useState(post.stats.commentCount);

  const commentsQuery = useInfiniteQuery({
    queryKey: ['comments', post.id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listComments(post.id, { limit: pageSize, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      let nextLikeState = likedByMe;
      if (nextLikeState === null) {
        const state = await getLikeState(post.id);
        nextLikeState = state.likedByMe;
      }

      if (nextLikeState) {
        return unlikePost(post.id);
      }

      return likePost(post.id);
    },
    onSuccess: (result) => {
      setLikedByMe(result.liked);
      setLikeCount(result.likeCount);
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        reconcileLikeCountInFeed(current, {
          postId: post.id,
          likeCount: result.likeCount,
        }),
      );
    },
    onError: (error) => {
      Alert.alert('Could not update like', (error as Error).message);
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (payload: { body: string; parentCommentId?: string }) =>
      createComment({
        postId: post.id,
        body: payload.body,
        ...(payload.parentCommentId ? { parentCommentId: payload.parentCommentId } : {}),
      }),
    onSuccess: (comment) => {
      setCommentText('');
      setReplyingTo(null);
      setCommentCount((count: number) => count + 1);
      queryClient.setQueryData<InfiniteData<PaginatedComments>>(
        ['comments', post.id],
        (current) => mergeCommentIntoFirstPage(current, comment),
      );
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        adjustCommentCountInFeed(current, {
          postId: post.id,
          delta: 1,
        }),
      );
    },
    onError: (error) => {
      Alert.alert('Could not create comment', (error as Error).message);
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
        ['comments', post.id],
        (current) => removeCommentFromPages(current, commentId),
      );
      queryClient.setQueryData(['feed'], (current: { pageParams: unknown[]; pages: PaginatedFeed[] } | undefined) =>
        adjustCommentCountInFeed(current, {
          postId: post.id,
          delta: -1,
        }),
      );
    },
    onError: (error) => {
      Alert.alert('Could not delete comment', (error as Error).message);
    },
  });

  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [commentsQuery.data],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.postCard}>
        <Text style={styles.authorName}>{post.author.displayName}</Text>
        <Text style={styles.timestamp}>{new Date(post.createdAt).toLocaleString()}</Text>
        <Text style={styles.content}>{post.content}</Text>
        {post.media.length ? (
          <View style={styles.mediaColumn}>
            {post.media.map((mediaItem: FeedPost['media'][number]) => (
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
            <Text style={styles.actionButtonText}>{likedByMe ? 'Unlike' : 'Like'} ({likeCount})</Text>
          </Pressable>
          <Text style={styles.commentCountLabel}>{commentCount} comments</Text>
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
                <Text style={styles.commentTime}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              <Text style={styles.commentBody}>{item.body}</Text>
              <Pressable
                style={styles.replyLinkButton}
                onPress={() => setReplyingTo(item)}
                disabled={createCommentMutation.isPending}
              >
                <Text style={styles.replyLinkText}>Reply</Text>
              </Pressable>
              {item.author.id === currentUserId ? (
                <Pressable
                  style={styles.deleteLinkButton}
                  onPress={() => deleteCommentMutation.mutate(item.id)}
                  disabled={deleteCommentMutation.isPending}
                >
                  <Text style={styles.deleteLinkText}>Delete</Text>
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
          ListEmptyComponent={<Text style={styles.emptyText}>No comments yet.</Text>}
        />
      )}

      <View style={styles.commentComposer}>
        {replyingTo ? (
          <View style={styles.replyContextRow}>
            <Text style={styles.replyContextText}>Replying to {replyingTo.author.displayName}</Text>
            <Pressable style={styles.replyCancelButton} onPress={() => setReplyingTo(null)}>
              <Text style={styles.replyCancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}
        <TextInput
          value={commentText}
          onChangeText={setCommentText}
          placeholder={replyingTo ? `Reply to ${replyingTo.author.displayName}` : 'Write a comment'}
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
          <Text style={styles.sendButtonText}>Send</Text>
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
