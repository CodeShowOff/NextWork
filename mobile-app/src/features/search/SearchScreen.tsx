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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchAll({ query: debouncedQuery, limit: 10 }),
    enabled: debouncedQuery.length > 0,
  });

  const hasResults = useMemo(() => {
    if (!searchQuery.data) {
      return false;
    }

    return (
      searchQuery.data.users.length > 0 ||
      searchQuery.data.groups.length > 0 ||
      searchQuery.data.posts.length > 0
    );
  }, [searchQuery.data]);

  const renderSearchHint = () => {
    if (!debouncedQuery) {
      return <Text style={styles.hintText}>{t('search.hint')}</Text>;
    }

    if (searchQuery.isLoading) {
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

        {searchQuery.data?.users.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('search.sections.users')}</Text>
            {searchQuery.data.users.map((user) => (
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
          </View>
        ) : null}

        {searchQuery.data?.groups.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('search.sections.groups')}</Text>
            {searchQuery.data.groups.map((group) => (
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
          </View>
        ) : null}

        {searchQuery.data?.posts.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('search.sections.posts')}</Text>
            {searchQuery.data.posts.map((post) => (
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
});
