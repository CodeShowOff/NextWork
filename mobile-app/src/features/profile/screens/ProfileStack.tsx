import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AppStackHeader } from '../../../app/AppStackHeader';
import { EditProfileScreen } from './EditProfileScreen';
import { FollowListScreen } from './FollowListScreen';
import { MyProfileScreen } from './MyProfileScreen';
import { SkillsScreen } from './SkillsScreen';
import { UserProfileScreen } from './UserProfileScreen';

export type ProfileStackParamList = {
  MyProfile: undefined;
  UserProfile: { userId: string };
  EditProfile: undefined;
  Skills: undefined;
  FollowList: { userId: string; mode: 'followers' | 'following'; title: string };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={{ header: AppStackHeader }}>
      <Stack.Screen name="MyProfile" component={MyProfileScreen} options={{ title: t('ui.headers.profile') }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: t('ui.headers.profile') }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: t('ui.headers.editProfile') }} />
      <Stack.Screen name="Skills" component={SkillsScreen} options={{ title: t('ui.headers.skills') }} />
      <Stack.Screen name="FollowList" component={FollowListScreen} options={({ route }: { route: { params: { title: string } } }) => ({ title: route.params.title })} />
    </Stack.Navigator>
  );
}
