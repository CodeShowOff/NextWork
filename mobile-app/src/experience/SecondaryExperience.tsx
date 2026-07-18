import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listCommentReports, resolveCommentReport } from '../shared/api/comments.api';
import { FeedPost, getPost } from '../shared/api/feed.api';
import {
  followUser,
  getRelationship,
  listFollowers,
  listFollowing,
  unfollowUser,
} from '../shared/api/follows.api';
import { listGroups } from '../shared/api/groups.api';
import { createConversation } from '../shared/api/messages.api';
import {
  getNotificationPreferences,
  listMutedNotificationUsers,
  openNotification,
  sendThanksProfileAction,
  unmuteNotificationUser,
  updateNotificationPreferences,
} from '../shared/api/notifications.api';
import {
  listMyOrganizations,
  switchOrganization,
  updateOrganization,
} from '../shared/api/organizations.api';
import { listMyPosts, listUserPosts } from '../shared/api/posts.api';
import {
  getProfile,
  replaceMySkills,
  searchSkills,
  updateMyProfile,
} from '../shared/api/profiles.api';
import { searchAll } from '../shared/api/search.api';
import { authSessionService } from '../shared/session/auth-session.service';
import { ThemePreference, useThemeStore } from '../shared/theme/theme.store';
import { getCurrentUser } from '../shared/api/users.api';
import { localeLabels, SupportedLocale, supportedLocales } from '../shared/i18n/resources';
import { useLocaleStore } from '../shared/i18n/locale.store';
import { radius, spacing, typography, useAppColors } from '../shared/ui/design-tokens';
import {
  Avatar,
  Button,
  CapabilityCard,
  Card,
  Chip,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  ModalSheet,
  SearchField,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  TextField,
} from '../presentation/components';
import { useToast } from '../presentation/feedback';
import { Page } from '../presentation/layout';
import { OfflineBanner } from '../presentation/resilience';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../features/notifications/hooks/useNotifications';
import { NotificationItem } from '../features/notifications/types';
import { RootStackParamList } from './navigation';
import { PostCard } from './HomeExperience';

type TabProps = NativeStackScreenProps<RootStackParamList, 'Main'>;
type ProfileProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;
type SearchProps = NativeStackScreenProps<RootStackParamList, 'Search'>;
type SettingsProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
type AdminProps = NativeStackScreenProps<RootStackParamList, 'Admin'>;
type ReportsProps = NativeStackScreenProps<RootStackParamList, 'CommentReports'>;
type PreviewProps = NativeStackScreenProps<RootStackParamList, 'Preview'>;

function BackHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  const colors = useAppColors();
  return (
    <View
      style={[
        styles.backHeader,
        { borderBottomColor: colors.border, backgroundColor: colors.surface },
      ]}
    >
      <IconButton icon="arrow-back" label="Back" onPress={onBack} />
      <Text accessibilityRole="header" style={[styles.backHeaderTitle, { color: colors.text }]}>
        {title}
      </Text>
      <View style={styles.backHeaderAction}>{action}</View>
    </View>
  );
}

export function NotificationsExperience({ navigation }: TabProps) {
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const notificationsQuery = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const items = useMemo(
    () => notificationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [notificationsQuery.data],
  );
  const [markingAll, setMarkingAll] = useState(false);
  const open = async (item: NotificationItem) => {
    try {
      const result = await openNotification(item.id);
      if (!item.isRead) await markRead(item.id).catch(() => undefined);
      if (result.action.target === 'messages') {
        navigation.navigate('Conversation', { conversationId: result.action.entityId });
        return;
      }
      if (result.action.target === 'profile') {
        navigation.navigate('Profile', { userId: result.action.entityId });
        return;
      }
      const post = await getPost(result.action.entityId);
      navigation.navigate('PostDetail', { post });
    } catch (error) {
      showToast({
        tone: 'error',
        message:
          error instanceof Error ? error.message : 'This notification is no longer available.',
      });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };
  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAll();
      showToast({ tone: 'success', message: 'All notifications marked as read.' });
    } catch {
      showToast({ tone: 'error', message: 'Could not update notifications.' });
    } finally {
      setMarkingAll(false);
    }
  };
  return (
    <Page keyboardAware={false} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.notificationList}
        showsVerticalScrollIndicator={false}
        refreshing={notificationsQuery.isRefetching}
        onRefresh={() => void notificationsQuery.refetch()}
        onEndReached={() => {
          if (notificationsQuery.hasNextPage && !notificationsQuery.isFetchingNextPage)
            void notificationsQuery.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={styles.notificationHeader}>
            <View style={styles.simpleTopBar}>
              <View>
                <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>
                  Notifications
                </Text>
                <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
                  Updates that need your attention.
                </Text>
              </View>
              <Button
                label="Mark all read"
                variant="secondary"
                onPress={() => void markAllRead()}
                loading={markingAll}
              />
            </View>
            <OfflineBanner />
          </View>
        }
        ListEmptyComponent={
          notificationsQuery.isLoading ? (
            <NotificationSkeleton />
          ) : notificationsQuery.isError ? (
            <ErrorState onRetry={() => void notificationsQuery.refetch()} />
          ) : (
            <EmptyState
              title="You’re all caught up"
              body="New mentions, reactions, and messages will appear here."
              icon="notifications-none"
            />
          )
        }
        renderItem={({ item }) => (
          <PressableNotification item={item} onPress={() => void open(item)} />
        )}
      />
    </Page>
  );
}

function PressableNotification({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const colors = useAppColors();
  const actor = item.actor?.displayName ?? 'Someone';
  const action =
    item.type === 'like'
      ? 'reacted to your post'
      : item.type === 'comment'
        ? 'commented on your post'
        : item.type === 'follow'
          ? 'started following you'
          : item.type === 'message'
            ? 'sent you a message'
            : item.type === 'thanks'
              ? 'sent you thanks'
              : 'shared an update';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.notification,
        {
          backgroundColor: !item.isRead
            ? colors.primarySoft
            : pressed
              ? colors.surfaceMuted
              : colors.background,
          borderColor: !item.isRead ? colors.primary : 'transparent',
        },
      ]}
    >
      <Avatar name={actor} uri={item.actor?.avatarUrl} size={44} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={[styles.notificationText, { color: colors.text }]}>
          <Text style={{ fontWeight: '900' }}>{actor}</Text> {action}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {relativeDate(item.createdAt)}
        </Text>
      </View>
      {!item.isRead ? (
        <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
      ) : null}
    </Pressable>
  );
}

export function MenuExperience({ navigation }: TabProps) {
  const colors = useAppColors();
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: listMyOrganizations,
  });
  const canAdmin = Boolean(
    organizationsQuery.data?.items.some((item) => item.role === 'owner' || item.role === 'admin'),
  );
  return (
    <Page scroll edges={['top', 'left', 'right', 'bottom']} contentStyle={styles.menuContent}>
      <View style={styles.menuTop}>
        <Text accessibilityRole="header" style={[styles.pageTitle, { color: colors.text }]}>
          Menu
        </Text>
        <IconButton
          icon="settings"
          label="Settings"
          onPress={() => navigation.navigate('Settings')}
          testID="header-settings"
        />
      </View>
      <Card raised>
        <ListRow
          title={meQuery.data?.email || 'Your profile'}
          subtitle="View profile and nextwork activity"
          leading={<Avatar name={meQuery.data?.email || 'You'} size={54} />}
          onPress={() => navigation.navigate('Profile')}
        />
      </Card>
      <SectionHeader title="Your NextWork" />
      <MenuItem
        title="Search"
        subtitle="People, groups, and updates"
        icon="search"
        onPress={() => navigation.navigate('Search')}
      />
      <MenuItem
        title="Settings"
        subtitle="Appearance, notifications, language"
        icon="settings"
        onPress={() => navigation.navigate('Settings')}
      />
      {canAdmin ? (
        <MenuItem
          title="Administration"
          subtitle="Organization and moderation controls"
          icon="admin-panel-settings"
          onPress={() => navigation.navigate('Admin')}
        />
      ) : null}
      <SectionHeader title="Explore" />
      <MenuItem
        title="Saved items"
        subtitle="A dedicated space for updates you want to revisit"
        icon="bookmark-border"
        onPress={() =>
          navigation.navigate('Preview', {
            title: 'Saved items',
            body: 'Saving updates is a polished preview surface until the backend has a shared saved-items contract.',
            icon: 'bookmark-border',
          })
        }
      />
      <MenuItem
        title="People directory"
        subtitle="Browse your organization"
        icon="groups"
        onPress={() =>
          navigation.navigate('Preview', {
            title: 'People directory',
            body: 'A directory preview is available here. Use Search to find live people today.',
            icon: 'groups',
          })
        }
      />
      <MenuItem
        title="Knowledge"
        subtitle="Policies, guides, and shared resources"
        icon="menu-book"
        onPress={() =>
          navigation.navigate('Preview', {
            title: 'Knowledge',
            body: 'Knowledge spaces will become available when content APIs are connected.',
            icon: 'menu-book',
          })
        }
      />
      <CapabilityCard
        capability="preview"
        title="More NextWork tools"
        body="These destinations are intentionally visible but never pretend to save or sync data before their APIs exist."
      />
    </Page>
  );
}

function MenuItem({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: any;
  onPress: () => void;
}) {
  const colors = useAppColors();
  return (
    <Card style={{ paddingVertical: spacing.xs }}>
      <ListRow
        title={title}
        subtitle={subtitle}
        leading={
          <View style={[styles.menuIcon, { backgroundColor: colors.primarySoft }]}>
            <IconButton icon={icon} label={title} onPress={onPress} />
          </View>
        }
        onPress={onPress}
      />
    </Card>
  );
}

export function ProfileExperience({ route, navigation }: ProfileProps) {
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const userId = route.params?.userId ?? meQuery.data?.id;
  const isOwn = Boolean(userId && userId === meQuery.data?.id);
  const profileQuery = useQuery({
    queryKey: ['profiles', userId],
    queryFn: () => getProfile(userId as string),
    enabled: Boolean(userId),
  });
  const relationshipQuery = useQuery({
    queryKey: ['follows', 'relationship', userId],
    queryFn: () => getRelationship(userId as string),
    enabled: Boolean(userId && !isOwn),
  });
  const orgsQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: listMyOrganizations,
    enabled: isOwn,
  });
  const postsQuery = useInfiniteQuery({
    queryKey: ['profiles', userId, 'posts'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      isOwn
        ? listMyPosts({ limit: 15, before: pageParam })
        : listUserPosts(userId as string, { limit: 15, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(userId),
  });
  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [postsQuery.data],
  );
  const [editOpen, setEditOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [followsOpen, setFollowsOpen] = useState<'followers' | 'following' | null>(null);
  const followMutation = useMutation<{ isFollowing: boolean }, Error, void>({
    mutationFn: async () =>
      relationshipQuery.data?.isFollowing ? unfollowUser(userId!) : followUser(userId!),
    onSuccess: () => void relationshipQuery.refetch(),
    onError: () => showToast({ tone: 'error', message: 'Could not update follow status.' }),
  });
  const messageMutation = useMutation({
    mutationFn: () => createConversation({ type: 'direct', participantIds: [userId!] }),
    onSuccess: (conversation) =>
      navigation.navigate('Conversation', { conversationId: conversation.id }),
    onError: () => showToast({ tone: 'error', message: 'Could not start a conversation.' }),
  });
  const thanksMutation = useMutation({
    mutationFn: () => sendThanksProfileAction({ targetUserId: userId! }),
    onSuccess: () => showToast({ tone: 'success', message: 'Thanks sent.' }),
    onError: () => showToast({ tone: 'error', message: 'Could not send thanks.' }),
  });
  if (profileQuery.isLoading)
    return (
      <Page>
        <ProfileSkeleton />
      </Page>
    );
  if (!profileQuery.data)
    return (
      <Page>
        <ErrorState onRetry={() => void profileQuery.refetch()} />
      </Page>
    );
  const profile = profileQuery.data;
  const canAdmin = Boolean(
    orgsQuery.data?.items.some((item) => item.role === 'owner' || item.role === 'admin'),
  );
  return (
    <Page keyboardAware={false} edges={['top', 'left', 'right', 'bottom']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.profileList}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage)
            void postsQuery.fetchNextPage();
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md }}>
            <BackHeader
              title={isOwn ? 'Your profile' : 'Profile'}
              onBack={() => navigation.goBack()}
              action={
                isOwn ? (
                  <IconButton icon="edit" label="Edit profile" onPress={() => setEditOpen(true)} />
                ) : undefined
              }
            />
            <View style={[styles.profileHero, { backgroundColor: colors.primary }]}>
              <View style={styles.profileGlow} />
              <Avatar name={profile.displayName} uri={profile.avatarUrl} size={88} />
              <Text style={styles.profileName}>{profile.displayName}</Text>
              {profile.jobTitle ? <Text style={styles.profileRole}>{profile.jobTitle}</Text> : null}
              {profile.bio ? <Text style={styles.profileBio}>{profile.bio}</Text> : null}
            </View>
            <Card>
              <View style={styles.metrics}>
                <Metric label="Posts" value={profile.counters.posts} />
                <PressableMetric
                  label="Followers"
                  value={profile.counters.followers}
                  onPress={() => setFollowsOpen('followers')}
                />
                <PressableMetric
                  label="Following"
                  value={profile.counters.following}
                  onPress={() => setFollowsOpen('following')}
                />
              </View>
            </Card>
            {isOwn ? (
              <View style={styles.profileActions}>
                <Button label="Edit profile" icon="edit" onPress={() => setEditOpen(true)} />
                <Button
                  label="Skills"
                  icon="workspace-premium"
                  variant="secondary"
                  onPress={() => setSkillsOpen(true)}
                />
                {canAdmin ? (
                  <Button
                    label="Admin"
                    icon="admin-panel-settings"
                    variant="secondary"
                    onPress={() => navigation.navigate('Admin')}
                  />
                ) : null}
              </View>
            ) : (
              <View style={styles.profileActions}>
                <Button
                  label="Message"
                  icon="chat"
                  onPress={() => messageMutation.mutate()}
                  loading={messageMutation.isPending}
                />
                <Button
                  label={relationshipQuery.data?.isFollowing ? 'Following' : 'Follow'}
                  icon="person-add-alt"
                  variant="secondary"
                  onPress={() => followMutation.mutate()}
                  loading={followMutation.isPending}
                />
                <Button
                  label="Send thanks"
                  icon="volunteer-activism"
                  variant="secondary"
                  onPress={() => thanksMutation.mutate()}
                  loading={thanksMutation.isPending}
                />
              </View>
            )}
            <Card>
              <SectionHeader
                title="Skills"
                action={
                  isOwn ? (
                    <Button label="Manage" variant="ghost" onPress={() => setSkillsOpen(true)} />
                  ) : undefined
                }
              />
              {profile.skills.length ? (
                <View style={styles.skillList}>
                  {profile.skills.map((skill) => (
                    <Chip key={skill.id} label={skill.name} selected />
                  ))}
                </View>
              ) : (
                <Text style={{ color: colors.textMuted }}>No skills have been added yet.</Text>
              )}
            </Card>
            <SectionHeader title="Activity" />
          </View>
        }
        ListEmptyComponent={
          postsQuery.isLoading ? (
            <ProfileSkeleton />
          ) : (
            <EmptyState
              title="No posts yet"
              body={
                isOwn
                  ? 'Your updates will appear on your profile.'
                  : 'This person has not shared any posts yet.'
              }
              icon="dynamic-feed"
            />
          )
        }
        renderItem={({ item }) => (
          <PostCard
            post={item as FeedPost}
            currentUserId={meQuery.data?.id}
            onOpen={() => navigation.navigate('PostDetail', { post: item as FeedPost })}
            onOpenProfile={(id) => navigation.push('Profile', { userId: id })}
            onChanged={() => {
              void postsQuery.refetch();
              void queryClient.invalidateQueries({ queryKey: ['feed'] });
            }}
            compact
          />
        )}
      />
      <EditProfileSheet
        visible={editOpen}
        profile={profile}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          void profileQuery.refetch();
        }}
      />
      <SkillsSheet
        visible={skillsOpen}
        initialSkills={profile.skills.map((item) => item.name)}
        onClose={() => setSkillsOpen(false)}
        onSaved={() => {
          setSkillsOpen(false);
          void profileQuery.refetch();
        }}
      />
      <FollowSheet
        visible={Boolean(followsOpen)}
        mode={followsOpen ?? 'followers'}
        userId={userId!}
        onClose={() => setFollowsOpen(null)}
        onProfile={(id) => {
          setFollowsOpen(null);
          navigation.push('Profile', { userId: id });
        }}
      />
    </Page>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const colors = useAppColors();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
function PressableMetric({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress: () => void;
}) {
  const colors = useAppColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={styles.metric}
    >
      <Text style={[styles.metricValue, { color: colors.text }]}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

function EditProfileSheet({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: Awaited<ReturnType<typeof getProfile>>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '');
  useEffect(() => {
    if (visible) {
      setDisplayName(profile.displayName);
      setJobTitle(profile.jobTitle ?? '');
      setBio(profile.bio ?? '');
      setAvatarUrl(profile.avatarUrl ?? '');
    }
  }, [profile, visible]);
  const mutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        displayName: displayName.trim(),
        jobTitle: jobTitle.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: () => showToast({ tone: 'error', message: 'Could not save profile.' }),
  });
  return (
    <ModalSheet
      visible={visible}
      title="Edit profile"
      onClose={onClose}
      footer={
        <Button
          fullWidth
          label="Save profile"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!displayName.trim()}
        />
      }
    >
      <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
      <TextField label="Job title" value={jobTitle} onChangeText={setJobTitle} />
      <TextField label="About you" value={bio} onChangeText={setBio} multiline />
      <TextField
        label="Photo URL"
        hint="Optional public image URL"
        value={avatarUrl}
        onChangeText={setAvatarUrl}
        autoCapitalize="none"
      />
    </ModalSheet>
  );
}

function SkillsSheet({
  visible,
  initialSkills,
  onClose,
  onSaved,
}: {
  visible: boolean;
  initialSkills: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState('');
  const [skills, setSkills] = useState(initialSkills);
  useEffect(() => {
    if (visible) setSkills(initialSkills);
  }, [initialSkills, visible]);
  const suggestionQuery = useQuery({
    queryKey: ['skills', draft],
    queryFn: () => searchSkills(draft),
    enabled: visible && draft.trim().length >= 2,
  });
  const add = (value: string) => {
    const next = value.trim();
    if (next && !skills.some((skill) => skill.toLowerCase() === next.toLowerCase()))
      setSkills((current) => [...current, next]);
    setDraft('');
  };
  const mutation = useMutation({
    mutationFn: () => replaceMySkills(skills),
    onSuccess: onSaved,
    onError: () => showToast({ tone: 'error', message: 'Could not save skills.' }),
  });
  return (
    <ModalSheet
      visible={visible}
      title="Skills"
      onClose={onClose}
      footer={
        <Button
          fullWidth
          label="Save skills"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
        />
      }
    >
      <TextField
        label="Add a skill"
        value={draft}
        onChangeText={setDraft}
        placeholder="e.g. Design systems"
        onSubmitEditing={() => add(draft)}
      />
      {(suggestionQuery.data?.items ?? []).map((item) => (
        <Button key={item.name} label={item.name} variant="ghost" onPress={() => add(item.name)} />
      ))}
      <View style={styles.skillList}>
        {skills.map((skill) => (
          <Chip
            key={skill}
            label={skill}
            selected
            onPress={() => setSkills((current) => current.filter((item) => item !== skill))}
            icon="close"
          />
        ))}
      </View>
    </ModalSheet>
  );
}

function FollowSheet({
  visible,
  mode,
  userId,
  onClose,
  onProfile,
}: {
  visible: boolean;
  mode: 'followers' | 'following';
  userId: string;
  onClose: () => void;
  onProfile: (id: string) => void;
}) {
  const query = useInfiniteQuery({
    queryKey: ['follows', mode, userId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      mode === 'followers'
        ? listFollowers(userId, { limit: 25, before: pageParam })
        : listFollowing(userId, { limit: 25, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: visible,
  });
  const people = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  return (
    <ModalSheet
      visible={visible}
      title={mode === 'followers' ? 'Followers' : 'Following'}
      onClose={onClose}
    >
      {query.isLoading ? (
        <ProfileSkeleton />
      ) : people.length ? (
        people.map((person) => (
          <ListRow
            key={person.userId}
            title={person.displayName}
            subtitle={`Connected ${relativeDate(person.followedAt)}`}
            leading={<Avatar name={person.displayName} uri={person.avatarUrl} />}
            onPress={() => onProfile(person.userId)}
          />
        ))
      ) : (
        <EmptyState
          title="No people here yet"
          body="This list will update as people follow each other."
          icon="people-outline"
        />
      )}
    </ModalSheet>
  );
}

export function SearchExperience({ route, navigation }: SearchProps) {
  const [query, setQuery] = useState(route.params?.query ?? '');
  const [scope, setScope] = useState<'all' | 'users' | 'groups' | 'posts'>('all');
  const resultQuery = useQuery({
    queryKey: ['search', query, scope],
    queryFn: () =>
      searchAll({ query: query.trim(), scope: scope === 'all' ? undefined : scope, limit: 20 }),
    enabled: query.trim().length >= 2,
  });
  return (
    <Page scroll edges={['top', 'left', 'right', 'bottom']}>
      <BackHeader title="Search" onBack={() => navigation.goBack()} />
      <SearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        autoFocus
        placeholder="Search people, groups, and posts"
      />
      <SegmentedControl
        value={scope}
        onChange={setScope}
        options={[
          { value: 'all', label: 'All' },
          { value: 'users', label: 'People' },
          { value: 'groups', label: 'Groups' },
          { value: 'posts', label: 'Posts' },
        ]}
      />
      {query.trim().length < 2 ? (
        <EmptyState
          title="Search your nextwork"
          body="Find teammates, groups, and important updates."
          icon="search"
        />
      ) : resultQuery.isLoading ? (
        <SearchSkeleton />
      ) : resultQuery.isError ? (
        <ErrorState onRetry={() => void resultQuery.refetch()} />
      ) : (
        <View style={{ gap: spacing.md }}>
          {(resultQuery.data?.users ?? []).map((person) => (
            <Card key={`u-${person.id}`}>
              <ListRow
                title={person.displayName}
                subtitle={person.email}
                leading={<Avatar name={person.displayName} uri={person.avatarUrl} />}
                onPress={() => navigation.navigate('Profile', { userId: person.id })}
              />
            </Card>
          ))}
          {(resultQuery.data?.groups ?? []).map((group) => (
            <Card key={`g-${group.id}`}>
              <ListRow
                title={group.name}
                subtitle={group.description || 'NextWork group'}
                leading={<Avatar name={group.name} />}
                onPress={() => navigation.navigate('GroupHub', { groupId: group.id })}
              />
            </Card>
          ))}
          {(resultQuery.data?.posts ?? []).map((post) => (
            <Card key={`p-${post.id}`}>
              <ListRow
                title={post.author.displayName}
                subtitle={post.content}
                leading={<Avatar name={post.author.displayName} uri={post.author.avatarUrl} />}
                onPress={async () => {
                  const canonical = await getPost(post.id);
                  navigation.navigate('PostDetail', { post: canonical });
                }}
              />
            </Card>
          ))}
          {!(
            resultQuery.data?.users.length ||
            resultQuery.data?.groups.length ||
            resultQuery.data?.posts.length
          ) ? (
            <EmptyState title="No results found" body="Try a different name, group, or phrase." />
          ) : null}
        </View>
      )}
    </Page>
  );
}

export function SettingsExperience({ navigation }: SettingsProps) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const theme = useThemeStore((state) => state.preference);
  const setTheme = useThemeStore((state) => state.setPreference);
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const orgsQuery = useQuery({ queryKey: ['organizations', 'me'], queryFn: listMyOrganizations });
  const preferencesQuery = useQuery({
    queryKey: ['notifications', 'preferences'],
    queryFn: getNotificationPreferences,
  });
  const mutedQuery = useQuery({
    queryKey: ['notifications', 'muted-users'],
    queryFn: listMutedNotificationUsers,
  });
  const updatePreferencesMutation = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => queryClient.setQueryData(['notifications', 'preferences'], data),
    onError: () => showToast({ tone: 'error', message: 'Could not update notification settings.' }),
  });
  const switchMutation = useMutation({
    mutationFn: switchOrganization,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      void queryClient.invalidateQueries({ queryKey: ['feed'] });
      showToast({ tone: 'success', message: 'Organization switched.' });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not switch organization.' }),
  });
  const unmuteMutation = useMutation({
    mutationFn: unmuteNotificationUser,
    onSuccess: () => void mutedQuery.refetch(),
    onError: () => showToast({ tone: 'error', message: 'Could not unmute person.' }),
  });
  return (
    <Page scroll edges={['top', 'left', 'right', 'bottom']}>
      <BackHeader title="Settings" onBack={() => navigation.goBack()} />
      <SettingsSection title="Account">
        <Button
          label="Sign out"
          variant="danger"
          icon="logout"
          onPress={() => setSignOutOpen(true)}
        />
      </SettingsSection>
      <SettingsSection title="Organization">
        {(orgsQuery.data?.items ?? []).map((membership) => {
          const active = membership.organizationId === meQuery.data?.activeOrganizationId;
          return (
            <ListRow
              key={membership.organizationId}
              title={membership.organization.name}
              subtitle={membership.role}
              leading={<Avatar name={membership.organization.name} size={36} />}
              trailing={
                <Button
                  label={active ? 'Active' : 'Switch'}
                  variant={active ? 'secondary' : 'primary'}
                  disabled={active}
                  loading={switchMutation.isPending}
                  onPress={() => switchMutation.mutate(membership.organizationId)}
                />
              }
            />
          );
        })}
      </SettingsSection>
      <SettingsSection title="Appearance">
        <View style={styles.chipWrap}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((value) => (
            <Chip
              key={value}
              label={
                value === 'system'
                  ? 'Use device setting'
                  : value.charAt(0).toUpperCase() + value.slice(1)
              }
              selected={theme === value}
              onPress={() => setTheme(value)}
            />
          ))}
        </View>
      </SettingsSection>
      <SettingsSection title="Language">
        <View style={styles.chipWrap}>
          {supportedLocales.map((value) => (
            <Chip
              key={value}
              label={localeLabels[value]}
              selected={locale === value}
              onPress={() => setLocale(value as SupportedLocale)}
            />
          ))}
        </View>
      </SettingsSection>
      <SettingsSection title="Notifications">
        {preferencesQuery.data ? (
          <>
            {(
              [
                { key: 'likeEnabled', label: 'Reactions' },
                { key: 'commentEnabled', label: 'Comments' },
                { key: 'followEnabled', label: 'Follows' },
                { key: 'messageEnabled', label: 'Messages' },
              ] as const
            ).map((item) => (
              <ListRow
                key={item.key}
                title={item.label}
                trailing={
                  <Switch
                    value={Boolean(preferencesQuery.data?.[item.key])}
                    onValueChange={(value) =>
                      updatePreferencesMutation.mutate({ [item.key]: value })
                    }
                    trackColor={{ false: colors.borderStrong, true: colors.primary }}
                    accessibilityLabel={`${item.label} notifications`}
                  />
                }
              />
            ))}
          </>
        ) : (
          <Skeleton height={120} />
        )}
      </SettingsSection>
      <SettingsSection title="Muted people">
        {(mutedQuery.data?.items ?? []).length ? (
          mutedQuery.data?.items.map((person) => (
            <ListRow
              key={person.userId}
              title={person.displayName}
              leading={<Avatar name={person.displayName} uri={person.avatarUrl} size={36} />}
              trailing={
                <Button
                  label="Unmute"
                  variant="secondary"
                  onPress={() => unmuteMutation.mutate(person.userId)}
                  loading={unmuteMutation.isPending}
                />
              }
            />
          ))
        ) : (
          <Text style={{ color: colors.textMuted }}>No muted people.</Text>
        )}
      </SettingsSection>
      <ConfirmSheet
        visible={signOutOpen}
        title="Sign out?"
        body="You’ll need to enter your credentials to return to this nextwork."
        confirmLabel="Sign out"
        destructive
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => void authSessionService.logout()}
      />
    </Page>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useAppColors();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[styles.settingsSectionTitle, { color: colors.text }]}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

export function AdminExperience({ navigation }: AdminProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const orgsQuery = useQuery({ queryKey: ['organizations', 'me'], queryFn: listMyOrganizations });
  const membership =
    orgsQuery.data?.items.find(
      (item) => item.organizationId === meQuery.data?.activeOrganizationId,
    ) ?? orgsQuery.data?.items[0];
  const canManage = membership?.role === 'owner' || membership?.role === 'admin';
  const [name, setName] = useState('');
  useEffect(() => setName(membership?.organization.name ?? ''), [membership?.organization.name]);
  const groupsQuery = useQuery({
    queryKey: ['groups', membership?.organizationId],
    queryFn: () => listGroups(membership!.organizationId),
    enabled: Boolean(membership && canManage),
  });
  const updateMutation = useMutation({
    mutationFn: () => updateOrganization(membership!.organizationId, { name: name.trim() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations'] });
      showToast({ tone: 'success', message: 'Organization saved.' });
    },
    onError: () => showToast({ tone: 'error', message: 'Could not update organization.' }),
  });
  if (meQuery.isLoading || orgsQuery.isLoading)
    return (
      <Page>
        <ProfileSkeleton />
      </Page>
    );
  if (!membership || !canManage)
    return (
      <Page>
        <EmptyState
          title="Admin access required"
          body="Only organization administrators can manage this area."
          icon="admin-panel-settings"
        />
      </Page>
    );
  return (
    <Page scroll edges={['top', 'left', 'right', 'bottom']}>
      <BackHeader title="Administration" onBack={() => navigation.goBack()} />
      <SettingsSection title="Organization">
        <TextField label="Organization name" value={name} onChangeText={setName} />
        <Button
          label="Save organization"
          onPress={() => updateMutation.mutate()}
          loading={updateMutation.isPending}
          disabled={!name.trim()}
        />
      </SettingsSection>
      <SettingsSection title="Groups">
        {groupsQuery.isLoading ? (
          <Skeleton height={100} />
        ) : (
          (groupsQuery.data?.items ?? []).map((group) => (
            <ListRow
              key={group.id}
              title={group.name}
              subtitle={`${group.memberCount} members`}
              onPress={() => navigation.navigate('GroupHub', { groupId: group.id })}
            />
          ))
        )}
      </SettingsSection>
      <SettingsSection title="Moderation">
        <Button
          label="Comment reports"
          icon="flag"
          variant="secondary"
          onPress={() => navigation.navigate('CommentReports')}
        />
      </SettingsSection>
    </Page>
  );
}

export function CommentReportsExperience({ navigation }: ReportsProps) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const reportsQuery = useQuery({
    queryKey: ['comments', 'reports', 'open'],
    queryFn: () => listCommentReports({ limit: 50, status: 'open' }),
  });
  const resolve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'dismiss' | 'remove_comment' }) =>
      resolveCommentReport(id, action),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['comments', 'reports'] }),
    onError: () => showToast({ tone: 'error', message: 'Could not resolve report.' }),
  });
  return (
    <Page scroll edges={['top', 'left', 'right', 'bottom']}>
      <BackHeader title="Comment reports" onBack={() => navigation.goBack()} />
      {reportsQuery.isLoading ? (
        <ProfileSkeleton />
      ) : reportsQuery.isError ? (
        <ErrorState onRetry={() => void reportsQuery.refetch()} />
      ) : (reportsQuery.data?.items ?? []).length ? (
        reportsQuery.data?.items.map((report) => (
          <Card key={report.id}>
            <Text style={[styles.reportReason, { color: colors.primary }]}>{report.reason}</Text>
            <Text style={{ color: colors.text }}>{report.comment.body}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Reported by {report.reporter.displayName}
            </Text>
            <View style={styles.actionPair}>
              <Button
                label="Dismiss"
                variant="secondary"
                onPress={() => resolve.mutate({ id: report.id, action: 'dismiss' })}
                loading={resolve.isPending}
              />
              <Button
                label="Remove comment"
                variant="danger"
                onPress={() => resolve.mutate({ id: report.id, action: 'remove_comment' })}
                disabled={resolve.isPending}
              />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState
          title="No open reports"
          body="Your moderation queue is clear."
          icon="verified"
        />
      )}
    </Page>
  );
}

export function PreviewExperience({ route, navigation }: PreviewProps) {
  const colors = useAppColors();
  return (
    <Page scroll edges={['top', 'left', 'right', 'bottom']}>
      <BackHeader title={route.params.title} onBack={() => navigation.goBack()} />
      <View style={styles.previewHero}>
        <View style={[styles.previewIcon, { backgroundColor: colors.primarySoft }]}>
          <IconButton
            icon={(route.params.icon as any) || 'auto-awesome'}
            label={route.params.title}
            onPress={() => undefined}
          />
        </View>
        <Text style={[styles.previewTitle, { color: colors.text }]}>{route.params.title}</Text>
        <Text style={[typography.body, { color: colors.textMuted, textAlign: 'center' }]}>
          {route.params.body}
        </Text>
      </View>
      <CapabilityCard
        capability="preview"
        title="Designed for the next release"
        body="This screen is intentionally polished but makes no unsupported backend changes."
      />
    </Page>
  );
}

function NotificationSkeleton() {
  return (
    <View style={{ gap: spacing.sm }}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={styles.notification}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Skeleton width="70%" />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}
function ProfileSkeleton() {
  return (
    <View style={{ gap: spacing.md, padding: spacing.md }}>
      <Skeleton height={220} radius={radius.lg} />
      <Skeleton height={100} radius={radius.lg} />
      <Skeleton height={180} radius={radius.lg} />
    </View>
  );
}
function SearchSkeleton() {
  return (
    <View style={{ gap: spacing.sm }}>
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <Skeleton height={50} />
        </Card>
      ))}
    </View>
  );
}
function relativeDate(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const hours = Math.floor(delta / 3_600_000);
  return hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  backHeader: {
    minHeight: 56,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '900',
  },
  backHeaderAction: { width: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  notificationList: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.xs },
  notificationHeader: { gap: spacing.md, marginBottom: spacing.xs },
  simpleTopBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pageTitle: { fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },
  notification: {
    minHeight: 72,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationText: { fontSize: 14, lineHeight: 20 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  menuContent: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  menuTop: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuIcon: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden' },
  profileList: { paddingBottom: spacing.xxl, gap: spacing.md },
  profileHero: {
    minHeight: 255,
    marginHorizontal: -spacing.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  profileGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -150,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileRole: {
    color: '#ECE4FF',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileBio: {
    color: '#F8F4FF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 430,
  },
  metrics: { flexDirection: 'row', justifyContent: 'space-around' },
  metric: { minWidth: 76, alignItems: 'center', gap: 2, padding: spacing.xs },
  metricValue: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  profileActions: {
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  skillList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  settingsSectionTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  actionPair: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  reportReason: { fontSize: 12, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase' },
  previewHero: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  previewIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: { fontSize: 26, lineHeight: 32, fontWeight: '900', textAlign: 'center' },
});
