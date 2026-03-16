import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FeedPost } from '../../../shared/api/feed.api';
import { FollowListScreen } from '../../profile/screens/FollowListScreen';
import { UserProfileScreen } from '../../profile/screens/UserProfileScreen';
import { FeedScreen } from '../FeedScreen';
import { PostDetailScreen } from './PostDetailScreen';

export type FeedStackParamList = {
  FeedHome: undefined;
  PostDetail: {
    post: FeedPost;
  };
  UserProfile: {
    userId: string;
  };
  FollowList: {
    userId: string;
    mode: 'followers' | 'following';
    title: string;
  };
};

const Stack = createNativeStackNavigator<FeedStackParamList>();

export function FeedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="FeedHome" component={FeedScreen} options={{ title: 'Feed' }} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ title: 'Post' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen
        name="FollowList"
        component={FollowListScreen}
        options={({ route }: { route: { params: { title: string } } }) => ({
          title: route.params.title,
        })}
      />
    </Stack.Navigator>
  );
}
