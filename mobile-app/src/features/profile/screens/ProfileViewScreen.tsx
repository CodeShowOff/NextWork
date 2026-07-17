import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { createPost } from '../../../shared/api/feed.api';
import { getRelationship, followUser, unfollowUser } from '../../../shared/api/follows.api';
import { sendThanksProfileAction } from '../../../shared/api/notifications.api';
import { listMyOrganizations } from '../../../shared/api/organizations.api';
import { PostItem, listMyPosts, listUserPosts } from '../../../shared/api/posts.api';
import { getProfile, updateMyProfile } from '../../../shared/api/profiles.api';
import { getCurrentUser } from '../../../shared/api/users.api';
import { featureFlags } from '../../../shared/config/runtime';
import { localeLabels, SupportedLocale, supportedLocales } from '../../../shared/i18n/resources';
import { useLocaleStore } from '../../../shared/i18n/locale.store';
import { useInviteLinkStore } from '../../../shared/session/invite-link.store';
import { authSessionService } from '../../../shared/session/auth-session.service';
import { ThemePreference, useThemeStore } from '../../../shared/theme/theme.store';
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
  const clearPendingInviteToken = useInviteLinkStore((state) => state.clearPendingInviteToken);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const themePreference = useThemeStore((state) => state.preference);
  const setThemePreference = useThemeStore((state) => state.setPreference);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [organizationSize, setOrganizationSize] = useState('');
  const [profileComposerText, setProfileComposerText] = useState('');
  const [thanksTemplate, setThanksTemplate] = useState('');
  const [thanksNotificationType, setThanksNotificationType] = useState<'thanks' | 'thanks-note'>('thanks');

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

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: listMyOrganizations,
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
    setThanksTemplate(t('profile.thanks.defaultTemplate'));
  }, [profileQuery.data, t]);

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

  const thanksMutation = useMutation({
    mutationFn: async () => {
      if (!profileUserId) {
        throw new Error('Missing profile user id');
      }

      return sendThanksProfileAction({
        targetUserId: profileUserId,
        notificationType: thanksNotificationType,
        messageTemplate:
          thanksTemplate.trim().length > 0 && thanksNotificationType === 'thanks-note'
            ? thanksTemplate.trim()
            : undefined,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      if (result.muted) {
        Alert.alert(t('profile.alerts.thanksMutedTitle'), t('profile.alerts.thanksMutedBody'));
        return;
      }

      Alert.alert(t('profile.alerts.thanksSentTitle'), t('profile.alerts.thanksSentBody'));
    },
    onError: (error) => {
      Alert.alert(t('profile.alerts.thanksFailedTitle'), (error as Error).message);
    },
  });

  const createProfilePostMutation = useMutation({
    mutationFn: async () => {
      const content = profileComposerText.trim();
      if (!content) {
        throw new Error(t('feed.alerts.writeBeforePosting'));
      }

      return createPost({ content });
    },
    onSuccess: () => {
      setProfileComposerText('');
      queryClient.invalidateQueries({ queryKey: ['profile', 'posts', profileUserId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => {
      Alert.alert(t('feed.alerts.createPostFailedTitle'), (error as Error).message);
    },
  });

  const posts = useMemo(() => postsQuery.data?.pages.flatMap((page) => page.items) ?? [], [postsQuery.data]);
  const activeOrganizationName = useMemo(() => {
    const memberships = organizationsQuery.data?.items ?? [];
    const activeOrganizationId = meQuery.data?.activeOrganizationId;

    if (!memberships.length) {
      return null;
    }

    if (!activeOrganizationId) {
      return memberships[0]?.organization.name ?? null;
    }

    return (
      memberships.find((membership) => membership.organizationId === activeOrganizationId)?.organization.name ??
      memberships[0]?.organization.name ??
      null
    );
  }, [meQuery.data?.activeOrganizationId, organizationsQuery.data?.items]);

  const loadingProfile = meQuery.isLoading || profileQuery.isLoading;
  const followersCount = relationshipQuery.data?.followersCount ?? 0;
  const followingCount = relationshipQuery.data?.followingCount ?? 0;
  const skillsEntriesCount = profileQuery.data?.counters.skillsEntries ?? 0;
  const groupsFollowedCount = profileQuery.data?.counters.groupsFollowed ?? 0;
  const relationshipLabel = isOwnProfile
    ? t('profile.relationship.self')
    : relationshipQuery.data?.isFollowing
      ? t('profile.relationship.following')
      : t('profile.relationship.notFollowing');
  const profileName = profileQuery.data?.displayName ?? (displayName.trim() || t('profile.subtitle.hidden'));
  const avatarInitial = profileName.slice(0, 1).toUpperCase();

  if (loadingProfile) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#0B6E4F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.card}>
        <View style={styles.topBarRow}>
          <View style={styles.topBarActions}>
            <MaterialIcons name="chevron-left" size={22} color="#111827" />
          </View>
          <Text style={styles.topBarName} numberOfLines={1}>{profileName}</Text>
          <View style={styles.topBarActions}>
            <MaterialIcons name="search" size={22} color="#111827" />
          </View>
        </View>

        <View style={styles.heroCard}>
          <Image
            source={require('../../../../assets/images/group_general.jpg')}
            style={styles.heroCover}
            resizeMode="cover"
          />
          <View style={styles.avatarWrap}>
            {avatarUrl.trim().length ? (
              <Image source={{ uri: avatarUrl.trim() }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={styles.avatarFallbackCircle}>
                <Text style={styles.avatarFallbackText}>{avatarInitial || 'U'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.heroName}>{profileName}</Text>

          <View style={styles.heroActionsRow}>
            <Pressable
              style={styles.heroPrimaryButton}
              onPress={() => {
                if (isOwnProfile) {
                  updateMutation.mutate({
                    displayName: displayName.trim() || undefined,
                    bio: bio.trim() || undefined,
                    avatarUrl: avatarUrl.trim() || undefined,
                    jobTitle: jobTitle.trim() || undefined,
                    organizationSize: organizationSize.trim() || undefined,
                  });
                  return;
                }

                thanksMutation.mutate();
              }}
              disabled={thanksMutation.isPending || updateMutation.isPending}
            >
              <Text style={styles.heroPrimaryButtonText}>{isOwnProfile ? t('profile.buttons.saveProfile') : t('profile.buttons.sendThanks')}</Text>
            </Pressable>
            <View style={styles.heroIconButton}><MaterialIcons name="photo-camera" size={16} color="#111827" /></View>
            <View style={styles.heroIconButton}><MaterialIcons name="more-horiz" size={16} color="#111827" /></View>
          </View>

          <View style={styles.profileInfoList}>
            <View style={styles.profileInfoRow}>
              <MaterialIcons name="work-outline" size={16} color="#9CA3AF" />
              <Text style={styles.profileInfoText}>{jobTitle.trim() || t('profile.details.worksAt', { organizationName: activeOrganizationName ?? t('profile.details.unknownOrganization') })}</Text>
            </View>
            <View style={styles.profileInfoRow}>
              <MaterialIcons name="location-on" size={16} color="#9CA3AF" />
              <Text style={styles.profileInfoText}>{organizationSize.trim() || 'London, UK'}</Text>
            </View>
            <View style={styles.profileInfoRow}>
              <MaterialIcons name="translate" size={16} color="#9CA3AF" />
              <Text style={styles.profileInfoText}>English, Spanish</Text>
            </View>
            <View style={styles.profileInfoRow}>
              <MaterialIcons name="email" size={16} color="#9CA3AF" />
              <Text style={styles.profileInfoText}>{profileQuery.data?.email ?? meQuery.data?.email ?? t('profile.subtitle.hidden')}</Text>
            </View>
            <View style={styles.profileInfoRow}>
              <MaterialIcons name="group" size={16} color="#9CA3AF" />
              <Text style={styles.profileInfoText}>{`Followed by ${followersCount} people`}</Text>
            </View>
          </View>

          <View style={styles.relationshipBadge}>
            <Text style={styles.relationshipBadgeText}>{relationshipLabel}</Text>
          </View>
        </View>

        {isOwnProfile && featureFlags.i18n ? (
          <View style={styles.preferencesPanel}>
            <View style={styles.localeRow}>
              <Text style={styles.localeTitle}>{t('profile.locale.title')}</Text>
              {supportedLocales.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.localeChip, locale === item ? styles.localeChipActive : null]}
                  onPress={() => setLocale(item as SupportedLocale)}
                  accessibilityRole="button"
                  accessibilityLabel={localeLabels[item]}
                  accessibilityState={{ selected: locale === item }}
                >
                  <Text style={styles.localeChipText}>{localeLabels[item]}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.localeRow}>
              <Text style={styles.localeTitle}>{t('profile.theme.title')}</Text>
              {(['system', 'light', 'dark'] as ThemePreference[]).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.localeChip, themePreference === option ? styles.localeChipActive : null]}
                  onPress={() => setThemePreference(option)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`profile.theme.${option}`)}
                  accessibilityState={{ selected: themePreference === option }}
                >
                  <Text style={styles.localeChipText}>{t(`profile.theme.${option}`)}</Text>
                </Pressable>
              ))}
            </View>
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

        {isOwnProfile ? (
          <View style={styles.createPostCard}>
            <Text style={styles.profileSectionTitle}>{t('profile.metrics.posts')}</Text>
            <TextInput
              value={profileComposerText}
              onChangeText={setProfileComposerText}
              placeholder={t('feed.composer.placeholder')}
              style={styles.input}
              multiline
            />
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                createProfilePostMutation.mutate();
              }}
              disabled={createProfilePostMutation.isPending}
            >
              <Text style={styles.primaryButtonText}>
                {createProfilePostMutation.isPending ? t('feed.composer.posting') : t('feed.composer.post')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.profileSectionCard}>
          <View style={styles.profileSectionHeaderRow}>
            <Text style={styles.profileSectionTitle}>{t('profile.sections.skills.title')}</Text>
            {isOwnProfile ? (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    t('profile.sections.skills.editTitle'),
                    t('profile.sections.skills.editBody'),
                  );
                }}
              >
                <Text style={styles.profileSectionAction}>{t('profile.sections.skills.edit')}</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.profileSectionSubtitle}>
            {t('profile.sections.skills.entries', { count: skillsEntriesCount })}
          </Text>
        </View>

        <View style={styles.profileSectionCard}>
          <Text style={styles.profileSectionTitle}>{t('profile.sections.groupsFollowed.title')}</Text>
          <Text style={styles.profileSectionSubtitle}>
            {t('profile.sections.groupsFollowed.count', { count: groupsFollowedCount })}
          </Text>
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
          <View style={styles.profileActionsWrap}>
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

            <View style={styles.thanksCard}>
              <Text style={styles.thanksTitle}>{t('profile.thanks.title')}</Text>
              <View style={styles.thanksTypeRow}>
                <Pressable
                  style={[
                    styles.thanksTypeChip,
                    thanksNotificationType === 'thanks' ? styles.thanksTypeChipActive : null,
                  ]}
                  onPress={() => setThanksNotificationType('thanks')}
                >
                  <Text
                    style={[
                      styles.thanksTypeChipText,
                      thanksNotificationType === 'thanks' ? styles.thanksTypeChipTextActive : null,
                    ]}
                  >
                    {t('profile.thanks.types.quick')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.thanksTypeChip,
                    thanksNotificationType === 'thanks-note' ? styles.thanksTypeChipActive : null,
                  ]}
                  onPress={() => setThanksNotificationType('thanks-note')}
                >
                  <Text
                    style={[
                      styles.thanksTypeChipText,
                      thanksNotificationType === 'thanks-note' ? styles.thanksTypeChipTextActive : null,
                    ]}
                  >
                    {t('profile.thanks.types.withNote')}
                  </Text>
                </Pressable>
              </View>

              {thanksNotificationType === 'thanks-note' ? (
                <TextInput
                  value={thanksTemplate}
                  onChangeText={setThanksTemplate}
                  placeholder={t('profile.thanks.placeholder')}
                  style={styles.input}
                  multiline
                />
              ) : null}

              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  thanksMutation.mutate();
                }}
                disabled={thanksMutation.isPending}
              >
                <Text style={styles.secondaryButtonText}>{t('profile.buttons.sendThanks')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {isOwnProfile ? (
          <Pressable
            style={styles.logoutButton}
            onPress={async () => {
              clearPendingInviteToken();
              await authSessionService.logout();
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
    backgroundColor: '#ECECEC',
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
    padding: 10,
    marginBottom: 10,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topBarName: {
    color: '#111827',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  topBarActions: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    marginBottom: 8,
  },
  heroCover: {
    width: '100%',
    height: 122,
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: -38,
  },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E7EB',
  },
  avatarFallbackCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
  },
  heroName: {
    marginTop: 7,
    textAlign: 'center',
    color: '#111827',
    fontSize: 22,
    fontWeight: '800',
  },
  heroActionsRow: {
    marginTop: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroPrimaryButton: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1877F2',
  },
  heroPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  heroIconButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileInfoList: {
    marginTop: 10,
    paddingHorizontal: 12,
    gap: 7,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileInfoText: {
    color: '#374151',
    fontSize: 12,
    flex: 1,
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
    marginBottom: 12,
    marginHorizontal: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  relationshipBadgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  localeRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferencesPanel: {
    marginTop: 10,
    gap: 4,
  },
  localeTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
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
  createPostCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  profileSectionCard: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  profileSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileSectionTitle: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  profileSectionSubtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 13,
  },
  profileSectionAction: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#1877F2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  profileActionsWrap: {
    marginTop: 12,
    gap: 10,
  },
  thanksCard: {
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    padding: 10,
  },
  thanksTitle: {
    color: '#312E81',
    fontWeight: '700',
  },
  thanksTypeRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  thanksTypeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#A5B4FC',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  thanksTypeChipActive: {
    backgroundColor: '#4338CA',
    borderColor: '#4338CA',
  },
  thanksTypeChipText: {
    color: '#1E1B4B',
    fontWeight: '600',
    fontSize: 12,
  },
  thanksTypeChipTextActive: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4338CA',
    backgroundColor: '#4338CA',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
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
