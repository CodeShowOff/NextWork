import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { FeedPost } from '../../shared/api/feed.api';
import { searchAll } from '../../shared/api/search.api';

const groupArtworkByKeyword: { keyword: string; source: ImageSourcePropType }[] = [
  { keyword: 'announcement', source: require('../../../assets/images/group_company_announcements.jpg') },
  { keyword: 'marketing', source: require('../../../assets/images/group_marketing_team.jpg') },
  { keyword: 'project', source: require('../../../assets/images/group_project_updates.jpg') },
  { keyword: 'general', source: require('../../../assets/images/group_general.jpg') },
  { keyword: 'social', source: require('../../../assets/images/group_company_social.jpg') },
];

export function SearchScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [usersNextCursor, setUsersNextCursor] = useState<string | null>(null);
  const [groupsNextCursor, setGroupsNextCursor] = useState<string | null>(null);
  const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null);
  const [requestedUsersCursor, setRequestedUsersCursor] = useState<string | null>(null);
  const [requestedGroupsCursor, setRequestedGroupsCursor] = useState<string | null>(null);
  const [requestedPostsCursor, setRequestedPostsCursor] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<'all' | 'users' | 'groups' | 'posts'>('all');
  const [users, setUsers] = useState<Awaited<ReturnType<typeof searchAll>>['users']>([]);
  const [groups, setGroups] = useState<Awaited<ReturnType<typeof searchAll>>['groups']>([]);
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof searchAll>>['posts']>([]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    setUsersNextCursor(null);
    setGroupsNextCursor(null);
    setPostsNextCursor(null);
    setRequestedUsersCursor(null);
    setRequestedGroupsCursor(null);
    setRequestedPostsCursor(null);
    setActiveScope('all');
    setUsers([]);
    setGroups([]);
    setPosts([]);
  }, [debouncedQuery]);

  const searchQuery = useQuery({
    queryKey: [
      'search',
      debouncedQuery,
      requestedUsersCursor,
      requestedGroupsCursor,
      requestedPostsCursor,
      activeScope,
    ],
    queryFn: () =>
      searchAll({
        query: debouncedQuery,
        limit: 10,
        usersCursor:
          activeScope === 'all' || activeScope === 'users' ? requestedUsersCursor ?? undefined : undefined,
        groupsCursor:
          activeScope === 'all' || activeScope === 'groups' ? requestedGroupsCursor ?? undefined : undefined,
        postsCursor:
          activeScope === 'all' || activeScope === 'posts' ? requestedPostsCursor ?? undefined : undefined,
        scope: activeScope,
      }),
    enabled: debouncedQuery.length > 0,
  });

  useEffect(() => {
    if (!searchQuery.data) {
      return;
    }

    const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
      const existing = new Set(current.map((item) => item.id));
      return [...current, ...incoming.filter((item) => !existing.has(item.id))];
    };

    if (activeScope === 'all' || activeScope === 'users') {
      setUsers((current) =>
        activeScope === 'all' && requestedUsersCursor === null
          ? searchQuery.data.users
          : mergeById(current, searchQuery.data.users),
      );
      setUsersNextCursor(searchQuery.data.pageInfo.usersNextCursor);
    }
    if (activeScope === 'all' || activeScope === 'groups') {
      setGroups((current) =>
        activeScope === 'all' && requestedGroupsCursor === null
          ? searchQuery.data.groups
          : mergeById(current, searchQuery.data.groups),
      );
      setGroupsNextCursor(searchQuery.data.pageInfo.groupsNextCursor);
    }
    if (activeScope === 'all' || activeScope === 'posts') {
      setPosts((current) =>
        activeScope === 'all' && requestedPostsCursor === null
          ? searchQuery.data.posts
          : mergeById(current, searchQuery.data.posts),
      );
      setPostsNextCursor(searchQuery.data.pageInfo.postsNextCursor);
    }
  }, [
    activeScope,
    requestedGroupsCursor,
    requestedPostsCursor,
    requestedUsersCursor,
    searchQuery.data,
  ]);

  const hasResults = useMemo(() => {
    if (!debouncedQuery) {
      return false;
    }

    return users.length > 0 || groups.length > 0 || posts.length > 0;
  }, [debouncedQuery, groups.length, posts.length, users.length]);

  const renderSearchHint = () => {
    if (!debouncedQuery) {
      return <Text style={styles.hintText}>{t('search.hint')}</Text>;
    }

    if (searchQuery.isLoading && !hasResults) {
      return <ActivityIndicator size="small" color="#0B6E4F" />;
    }

    if (searchQuery.isError) {
      return <Text style={styles.errorText}>{t('search.error')}</Text>;
    }

    if (!hasResults) {
      return <Text style={styles.hintText}>{t('search.noMatches', { query: debouncedQuery })}</Text>;
    }

    return null;
  };

  const resolveGroupArtwork = (groupName: string): ImageSourcePropType => {
    const normalized = groupName.toLowerCase();
    for (const artwork of groupArtworkByKeyword) {
      if (normalized.includes(artwork.keyword)) {
        return artwork.source;
      }
    }

    return require('../../../assets/images/group_general.jpg');
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('search.title')}</Text>
        <View style={styles.searchInputRow}>
          <MaterialIcons name="search" size={24} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {renderSearchHint()}

        {users.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('search.sections.users')}</Text>
            {users.map((user) => (
              <Pressable
                key={user.id}
                style={styles.itemCard}
                onPress={() =>
                  (navigation as unknown as { navigate: (name: string, params: unknown) => void }).navigate('Feed', {
                    screen: 'UserProfile',
                    params: { userId: user.id },
                  })
                }
              >
                <View style={styles.itemRow}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{user.displayName.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.itemTextCol}>
                    <Text style={styles.itemTitle}>{user.displayName}</Text>
                    <Text style={styles.itemMeta}>{user.email}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
            {usersNextCursor ? (
              <Pressable
                style={styles.loadMoreButton}
                onPress={() => {
                  setActiveScope('users');
                  setRequestedUsersCursor(usersNextCursor);
                }}
                disabled={searchQuery.isFetching}
              >
                <Text style={styles.loadMoreText}>{t('search.actions.loadMoreUsers')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {groups.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('search.sections.groups')}</Text>
            {groups.map((group) => (
              <Pressable
                key={group.id}
                style={styles.itemCard}
                onPress={() => {
                  (navigation as unknown as { navigate: (name: string, params: unknown) => void }).navigate(
                    'Groups',
                    {
                      focusGroupId: group.id,
                      organizationId: group.organizationId,
                    },
                  );
                }}
              >
                <View style={styles.itemRow}>
                  <Image source={resolveGroupArtwork(group.name)} style={styles.groupAvatarImage} />
                  <View style={styles.itemTextCol}>
                    <Text style={styles.itemTitle}>{group.name}</Text>
                    {group.description ? <Text style={styles.itemMeta}>{group.description}</Text> : null}
                  </View>
                </View>
              </Pressable>
            ))}
            {groupsNextCursor ? (
              <Pressable
                style={styles.loadMoreButton}
                onPress={() => {
                  setActiveScope('groups');
                  setRequestedGroupsCursor(groupsNextCursor);
                }}
                disabled={searchQuery.isFetching}
              >
                <Text style={styles.loadMoreText}>{t('search.actions.loadMoreGroups')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {posts.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('search.sections.posts')}</Text>
            {posts.map((post) => (
              <Pressable
                key={post.id}
                style={styles.itemCard}
                onPress={() => {
                  const feedPost: FeedPost = {
                    id: post.id,
                    authorId: post.authorId,
                    groupId: post.groupId,
                    content: post.content,
                    visibility: 'public',
                    createdAt: post.createdAt,
                    updatedAt: post.createdAt,
                    media: [],
                    taggedUserIds: [],
                    hashtags: [],
                    poll: null,
                    author: post.author,
                    stats: {
                      likeCount: 0,
                      commentCount: 0,
                    },
                  };

                  (navigation as unknown as { navigate: (name: string, params: unknown) => void }).navigate('Feed', {
                    screen: 'PostDetail',
                    params: { post: feedPost },
                  });
                }}
              >
                <View style={styles.itemRow}>
                  <View style={styles.postIconAvatar}>
                    <MaterialIcons name="article" size={18} color="#6B7280" />
                  </View>
                  <View style={styles.itemTextCol}>
                    <Text style={styles.itemTitle}>{post.author.displayName}</Text>
                    <Text style={styles.itemMeta} numberOfLines={2}>
                      {post.content}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
            {postsNextCursor ? (
              <Pressable
                style={styles.loadMoreButton}
                onPress={() => {
                  setActiveScope('posts');
                  setRequestedPostsCursor(postsNextCursor);
                }}
                disabled={searchQuery.isFetching}
              >
                <Text style={styles.loadMoreText}>{t('search.actions.loadMorePosts')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ECECEC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
  },
  searchInputRow: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
  },
  content: {
    padding: 14,
    gap: 14,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemTextCol: {
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 20,
  },
  groupAvatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  postIconAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    color: '#1F2937',
    fontWeight: '700',
    fontSize: 15,
  },
  itemMeta: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 3,
  },
  hintText: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
  },
  errorText: {
    color: '#B91C1C',
    textAlign: 'center',
    marginTop: 12,
  },
  loadMoreButton: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#FFFFFF',
  },
  loadMoreText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 12,
  },
});
