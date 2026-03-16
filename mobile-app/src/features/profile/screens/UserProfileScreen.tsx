import React from 'react';
import { ProfileViewScreen } from './ProfileViewScreen';

interface Props {
  navigation: {
    navigate: (screen: string, params?: unknown) => void;
  };
  route: {
    params: {
      userId: string;
    };
  };
}

export function UserProfileScreen({ navigation, route }: Props) {
  return <ProfileViewScreen navigation={navigation} userId={route.params.userId} />;
}
