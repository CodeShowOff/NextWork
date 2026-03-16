import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ProfileStackParamList } from './ProfileStack';
import { ProfileViewScreen } from './ProfileViewScreen';

type Props = NativeStackScreenProps<ProfileStackParamList, 'MyProfile'>;

export function MyProfileScreen({ navigation }: Props) {
  return <ProfileViewScreen navigation={navigation} />;
}
