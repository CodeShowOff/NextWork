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
import { useTranslation } from 'react-i18next';

import { getRelationship, followUser, unfollowUser } from '../../../shared/api/follows.api';
import { PostItem, listMyPosts, listUserPosts } from '../../../shared/api/posts.api';
import { getProfile, updateMyProfile } from '../../../shared/api/profiles.api';
import { getCurrentUser } from '../../../shared/api/users.api';
import { featureFlags } from '../../../shared/config/runtime';
import { localeLabels, SupportedLocale, supportedLocales } from '../../../shared/i18n/resources';
import { useLocaleStore } from '../../../shared/i18n/locale.store';
import { useInviteLinkStore } from '../../../shared/session/invite-link.store';
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearPendingInviteToken = useInviteLinkStore((state) => state.clearPendingInviteToken);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);

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
      Alert.alert(t('profile.alerts.savedTitle'), t('profile.alerts.savedBody'));
    },
    onError: (error) => Alert.alert(t('profile.alerts.updateProfileFailed'), (error as Error).message),
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

      Alert.alert(t('profile.alerts.updateFollowFailed'), (error as Error).message);
    },
  });

  const posts = useMemo(() => postsQuery.data?.pages.flatMap((page) => page.items) ?? [], [postsQuery.data]);

  const loadingProfile = meQuery.isLoading || profileQuery.isLoading;
  const followersCount = relationshipQuery.data?.followersCount ?? 0;
  const followingCount = relationshipQuery.data?.followingCount ?? 0;
  const relationshipLabel = isOwnProfile
    ? t('profile.relationship.self')
    : relationshipQuery.data?.isFollowing
      ? t('profile.relationship.following')
      : t('profile.relationship.notFollowing');

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
        <Text style={styles.title}>{isOwnProfile ? t('profile.title.mine') : t('profile.title.other')}</Text>
        <Text style={styles.subtitle}>
          {t('profile.subtitle.email', {
            email: isOwnProfile ? meQuery.data?.email : t('profile.subtitle.hidden'),
          })}
        </Text>
        <View style={styles.relationshipBadge}>
          <Text style={styles.relationshipBadgeText}>{relationshipLabel}</Text>
        </View>

        {isOwnProfile && featureFlags.i18n ? (
          <View style={styles.localeRow}>
            {supportedLocales.map((item) => (
              <Pressable
                key={item}
                style={[styles.localeChip, locale === item ? styles.localeChipActive : null]}
                onPress={() => setLocale(item as SupportedLocale)}
              >
                <Text style={styles.localeChipText}>{localeLabels[item]}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

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
                title: t('profile.metrics.followers'),
              });
            }}
          >
            <Text style={styles.metricValue}>{followersCount}</Text>
            <Text style={styles.metricLabel}>{t('profile.metrics.followers')}</Text>
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
                title: t('profile.metrics.following'),
              });
            }}
          >
            <Text style={styles.metricValue}>{followingCount}</Text>
            <Text style={styles.metricLabel}>{t('profile.metrics.following')}</Text>
          </Pressable>
          <View style={styles.metricButton}>
            <Text style={styles.metricValue}>{posts.length}</Text>
            <Text style={styles.metricLabel}>{t('profile.metrics.posts')}</Text>
          </View>
        </View>

        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={t('profile.placeholders.displayName')}
          style={styles.input}
          editable={isOwnProfile}
        />
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder={t('profile.placeholders.bio')}
          style={styles.input}
          multiline
          editable={isOwnProfile}
        />
        <TextInput
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder={t('profile.placeholders.avatarUrl')}
          style={styles.input}
          autoCapitalize="none"
          editable={isOwnProfile}
        />
        <TextInput
          value={jobTitle}
          onChangeText={setJobTitle}
          placeholder={t('profile.placeholders.jobTitle')}
          style={styles.input}
          editable={isOwnProfile}
        />
        <TextInput
          value={organizationSize}
          onChangeText={setOrganizationSize}
          placeholder={t('profile.placeholders.organizationSize')}
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
            <Text style={styles.primaryButtonText}>{t('profile.buttons.saveProfile')}</Text>
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
              {relationshipQuery.data?.isFollowing
                ? t('profile.buttons.unfollow')
                : t('profile.buttons.follow')}
            </Text>
          </Pressable>
        )}

        {isOwnProfile ? (
          <Pressable
            style={styles.logoutButton}
            onPress={() => {
              clearPendingInviteToken();
              clearSession();
            }}
          >
            <Text style={styles.logoutButtonText}>{t('profile.buttons.signOut')}</Text>
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
                {t('profile.postStats', {
                  likes: item.stats.likeCount,
                  comments: item.stats.commentCount,
                })}
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
          ListEmptyComponent={<Text style={styles.emptyText}>{t('profile.emptyPosts')}</Text>}
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
  localeRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  localeChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  localeChipActive: {
    borderColor: '#0B6E4F',
    backgroundColor: '#DCFCE7',
  },
  localeChipText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
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
