import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';

import { listLikers, LikersResponse } from '../../../shared/api/likes.api';
import { i18n } from '../../../shared/i18n/i18n';
import { FeedStackParamList } from './FeedStack';
import { LIKER_PAGE_SIZE, shouldFetchNextLikersPage } from '../likers-list.logic';

type Props = NativeStackScreenProps<FeedStackParamList, 'LikerList'>;

type LikerListItem = LikersResponse['items'][number];

export function LikerListScreen({ navigation, route }: Props) {
  const { postId } = route.params;

  const query = useInfiniteQuery({
    queryKey: ['likes', 'post', postId, 'users'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listLikers(postId, { limit: LIKER_PAGE_SIZE, before: pageParam }),
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
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList<LikerListItem>
        data={items}
        keyExtractor={(item) => `${item.userId}:${item.likedAt}`}
        renderItem={({ item }) => (
          <Pressable
            style={styles.userCard}
            onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
            accessibilityRole="button"
            accessibilityLabel={`Open profile for ${item.displayName}`}
          >
            {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder} />}
            <View style={styles.userCopy}>
              <Text style={styles.userName}>{item.displayName}</Text>
              <Text style={styles.userMeta}>
                {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
                  new Date(item.likedAt),
                )}
              </Text>
            </View>
          </Pressable>
        )}
        onEndReached={() => {
          if (shouldFetchNextLikersPage(query.hasNextPage, query.isFetchingNextPage)) {
            query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#0B6E4F" style={styles.footerSpinner} />
          ) : null
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No likes yet.</Text>}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#CBD5E1',
  },
  userCopy: {
    flex: 1,
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
