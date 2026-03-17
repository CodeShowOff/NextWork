import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { FeedPost } from '../../shared/api/feed.api';
import { searchAll } from '../../shared/api/search.api';

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('search.title')}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
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
                <Text style={styles.itemTitle}>{user.displayName}</Text>
                <Text style={styles.itemMeta}>{user.email}</Text>
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
                <Text style={styles.itemTitle}>{group.name}</Text>
                {group.description ? <Text style={styles.itemMeta}>{group.description}</Text> : null}
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
                <Text style={styles.itemTitle}>{post.author.displayName}</Text>
                <Text style={styles.itemMeta} numberOfLines={2}>
                  {post.content}
                </Text>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    padding: 12,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: 12,
    gap: 12,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  itemTitle: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
  itemMeta: {
    color: '#475569',
    fontSize: 13,
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
    borderColor: '#0B6E4F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: '#FFFFFF',
  },
  loadMoreText: {
    color: '#0B6E4F',
    fontWeight: '700',
    fontSize: 12,
  },
});
