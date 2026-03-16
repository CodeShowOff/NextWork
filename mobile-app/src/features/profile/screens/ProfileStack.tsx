import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { FollowListScreen } from './FollowListScreen';
import { MyProfileScreen } from './MyProfileScreen';
import { UserProfileScreen } from './UserProfileScreen';

export type ProfileStackParamList = {
  MyProfile: undefined;
  UserProfile: {
    userId: string;
  };
  FollowList: {
    userId: string;
    mode: 'followers' | 'following';
    title: string;
  };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: 'Profile' }} />
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
