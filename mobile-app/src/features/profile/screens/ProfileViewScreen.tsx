import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRelationship, followUser, unfollowUser } from '../../../shared/api/follows.api';
import { PostItem, listMyPosts, listUserPosts } from '../../../shared/api/posts.api';
import { getProfile, updateMyProfile } from '../../../shared/api/profiles.api';
import { getCurrentUser } from '../../../shared/api/users.api';
import { useSessionStore } from '../../../shared/session/session.store';
import { toggleFollowRelationshipOptimistic } from '../follow-relationship-cache';

const pageSize = 20;

type StackNavigation = {
  navigate: (screen: string, params?: unknown) => void;
};

interface Props {
  navigation: StackNavigation;
  userId?: string;
}

export function ProfileViewScreen({ navigation, userId }: Props) {
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clearSession);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [organizationSize, setOrganizationSize] = useState('');

  const meQuery = useQuery({
    queryKey: ['users', 'me'],
    queryFn: getCurrentUser,
  });

  const profileUserId = userId ?? meQuery.data?.id;
  const isOwnProfile = Boolean(profileUserId && meQuery.data?.id && profileUserId === meQuery.data.id);

  const profileQuery = useQuery({
    queryKey: ['profiles', profileUserId],
    queryFn: () => getProfile(profileUserId as string),
    enabled: Boolean(profileUserId),
  });

  const relationshipQuery = useQuery({
    queryKey: ['follows', 'relationship', profileUserId],
    queryFn: () => getRelationship(profileUserId as string),
    enabled: Boolean(profileUserId),
  });

  const postsQuery = useInfiniteQuery({
    queryKey: ['profile', 'posts', profileUserId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      isOwnProfile
        ? listMyPosts({ limit: pageSize, before: pageParam })
        : listUserPosts(profileUserId as string, { limit: pageSize, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(profileUserId),
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setDisplayName(profileQuery.data.displayName ?? '');
    setBio(profileQuery.data.bio ?? '');
    setAvatarUrl(profileQuery.data.avatarUrl ?? '');
    setJobTitle(profileQuery.data.jobTitle ?? '');
    setOrganizationSize(profileQuery.data.organizationSize ?? '');
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles', meQuery.data?.id] });
      Alert.alert('Saved', 'Your profile was updated.');
    },
    onError: (error) => Alert.alert('Could not update profile', (error as Error).message),
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!profileUserId) {
        throw new Error('Missing profile user id');
      }

      const isFollowing = relationshipQuery.data?.isFollowing ?? false;
      if (isFollowing) {
        return unfollowUser(profileUserId);
      }

      return followUser(profileUserId);
    },
    onMutate: async () => {
      if (!profileUserId || isOwnProfile) {
        return undefined;
      }

      await queryClient.cancelQueries({ queryKey: ['follows', 'relationship', profileUserId] });
      const previousRelationship = queryClient.getQueryData(['follows', 'relationship', profileUserId]);

      queryClient.setQueryData(['follows', 'relationship', profileUserId], (current: unknown) =>
        toggleFollowRelationshipOptimistic(current as
          | {
              isFollowing: boolean;
              followersCount: number;
              followingCount: number;
            }
          | undefined),
      );

      return { previousRelationship };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follows', 'relationship', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['follows', 'followers', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['follows', 'following', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['follows', 'relationship', meQuery.data?.id] });
    },
    onError: (error, _variables, context) => {
      if (profileUserId && context?.previousRelationship) {
        queryClient.setQueryData(['follows', 'relationship', profileUserId], context.previousRelationship);
      }

      Alert.alert('Could not update follow status', (error as Error).message);
    },
  });

  const posts = useMemo(() => postsQuery.data?.pages.flatMap((page) => page.items) ?? [], [postsQuery.data]);

  const loadingProfile = meQuery.isLoading || profileQuery.isLoading;
  const followersCount = relationshipQuery.data?.followersCount ?? 0;
  const followingCount = relationshipQuery.data?.followingCount ?? 0;
  const relationshipLabel = isOwnProfile
    ? 'This is you'
    : relationshipQuery.data?.isFollowing
      ? 'Following'
      : 'Not following';

  if (loadingProfile) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#0B6E4F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{isOwnProfile ? 'My Profile' : 'Profile'}</Text>
        <Text style={styles.subtitle}>Email: {isOwnProfile ? meQuery.data?.email : 'Hidden'}</Text>
        <View style={styles.relationshipBadge}>
          <Text style={styles.relationshipBadgeText}>{relationshipLabel}</Text>
        </View>

        <View style={styles.metricsRow}>
          <Pressable
            style={styles.metricButton}
            onPress={() => {
              if (!profileUserId) {
                return;
              }

              navigation.navigate('FollowList', {
                userId: profileUserId,
                mode: 'followers',
                title: 'Followers',
              });
            }}
          >
            <Text style={styles.metricValue}>{followersCount}</Text>
            <Text style={styles.metricLabel}>Followers</Text>
          </Pressable>
          <Pressable
            style={styles.metricButton}
            onPress={() => {
              if (!profileUserId) {
                return;
              }

              navigation.navigate('FollowList', {
                userId: profileUserId,
                mode: 'following',
                title: 'Following',
              });
            }}
          >
            <Text style={styles.metricValue}>{followingCount}</Text>
            <Text style={styles.metricLabel}>Following</Text>
          </Pressable>
          <View style={styles.metricButton}>
            <Text style={styles.metricValue}>{posts.length}</Text>
            <Text style={styles.metricLabel}>Posts</Text>
          </View>
        </View>

        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          style={styles.input}
          editable={isOwnProfile}
        />
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Bio"
          style={styles.input}
          multiline
          editable={isOwnProfile}
        />
        <TextInput
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder="Avatar URL"
          style={styles.input}
          autoCapitalize="none"
          editable={isOwnProfile}
        />
        <TextInput
          value={jobTitle}
          onChangeText={setJobTitle}
          placeholder="Job title"
          style={styles.input}
          editable={isOwnProfile}
        />
        <TextInput
          value={organizationSize}
          onChangeText={setOrganizationSize}
          placeholder="Organization size"
          style={styles.input}
          editable={isOwnProfile}
        />

        {isOwnProfile ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              updateMutation.mutate({
                displayName: displayName.trim() || undefined,
                bio: bio.trim() || undefined,
                avatarUrl: avatarUrl.trim() || undefined,
                jobTitle: jobTitle.trim() || undefined,
                organizationSize: organizationSize.trim() || undefined,
              });
            }}
          >
            <Text style={styles.primaryButtonText}>Save profile</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              followMutation.mutate();
            }}
            disabled={followMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>
              {relationshipQuery.data?.isFollowing ? 'Unfollow' : 'Follow'}
            </Text>
          </Pressable>
        )}

        {isOwnProfile ? (
          <Pressable
            style={styles.logoutButton}
            onPress={() => {
              clearSession();
            }}
          >
            <Text style={styles.logoutButtonText}>Sign out</Text>
          </Pressable>
        ) : null}
      </View>

      {postsQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color="#0B6E4F" />
        </View>
      ) : (
        <FlatList<PostItem>
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <Text style={styles.postAuthor}>{item.author.displayName}</Text>
              <Text style={styles.postTime}>{new Date(item.createdAt).toLocaleString()}</Text>
              <Text style={styles.postContent}>{item.content}</Text>
              <Text style={styles.postStats}>
                {item.stats.likeCount} likes · {item.stats.commentCount} comments
              </Text>
            </View>
          )}
          onEndReached={() => {
            if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) {
              postsQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            postsQuery.isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#0B6E4F" style={styles.footerSpinner} />
            ) : null
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No posts yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 12,
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
    padding: 12,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 6,
    color: '#475569',
  },
  relationshipBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  relationshipBadgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  metricsRow: {
    marginTop: 10,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  metricValue: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#0B6E4F',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B91C1C',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  postAuthor: {
    color: '#0F172A',
    fontWeight: '700',
  },
  postTime: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
  },
  postContent: {
    marginTop: 8,
    color: '#0F172A',
    lineHeight: 20,
  },
  postStats: {
    marginTop: 8,
    color: '#475569',
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
});
