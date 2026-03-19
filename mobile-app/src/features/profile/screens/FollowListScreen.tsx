import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { FollowUserItem, listFollowers, listFollowing } from '../../../shared/api/follows.api';
interface Props {
  navigation: {
    navigate: (screen: string, params?: unknown) => void;
  };
  route: {
    params: {
      userId: string;
      mode: 'followers' | 'following';
      title: string;
    };
  };
}

const pageSize = 20;

export function FollowListScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { userId, mode } = route.params;

  const query = useInfiniteQuery({
    queryKey: ['follows', mode, userId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      mode === 'followers'
        ? listFollowers(userId, { limit: pageSize, before: pageParam })
        : listFollowing(userId, { limit: pageSize, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  if (query.isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color="#0B6E4F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList<FollowUserItem>
        data={items}
        keyExtractor={(item) => item.userId + item.followedAt}
        renderItem={({ item }) => (
          <Pressable
            style={styles.userCard}
            onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
          >
            <Text style={styles.userName}>{item.displayName}</Text>
            <Text style={styles.userMeta}>{new Date(item.followedAt).toLocaleString()}</Text>
          </Pressable>
        )}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#0B6E4F" style={styles.footerSpinner} />
          ) : null
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{t('profile.followList.empty')}</Text>}
      />
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
  userCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  userName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  userMeta: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 12,
  },
  footerSpinner: {
    marginVertical: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#64748B',
  },
});
