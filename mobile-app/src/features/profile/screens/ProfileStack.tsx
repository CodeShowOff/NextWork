import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { FollowListScreen } from './FollowListScreen';
import { MyProfileScreen } from './MyProfileScreen';
import { UserProfileScreen } from './UserProfileScreen';
import { SharedTopBarBrand, SharedTopBarSearchAction, sharedHeaderBaseOptions } from '../../../shared/ui/SharedTopBar';

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
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        ...sharedHeaderBaseOptions,
        headerRight: () => (
          <SharedTopBarSearchAction
            onPress={() => navigation.getParent()?.navigate('Search' as never)}
            accessibilityLabel={t('app.tabs.search')}
          />
        ),
      })}
    >
      <Stack.Screen
        name="MyProfile"
        component={MyProfileScreen}
        options={{
          headerTitle: () => <SharedTopBarBrand />,
        }}
      />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: t('app.tabs.profile') }} />
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
