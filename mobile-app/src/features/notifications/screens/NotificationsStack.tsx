import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AppStackHeader } from '../../../app/AppStackHeader';
import { NotificationsScreen } from './NotificationsScreen';

type NotificationsStackParamList = { NotificationsHome: undefined };
const Stack = createNativeStackNavigator<NotificationsStackParamList>();

export function NotificationsStack() {
  const { t } = useTranslation();
  return <Stack.Navigator screenOptions={{ header: AppStackHeader }}><Stack.Screen name="NotificationsHome" component={NotificationsScreen} options={{ title: t('ui.headers.notifications') }} /></Stack.Navigator>;
}
