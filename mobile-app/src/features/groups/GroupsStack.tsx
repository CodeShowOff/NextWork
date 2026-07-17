import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { AppStackHeader } from '../../app/AppStackHeader';
import { GroupCreateScreen } from './GroupCreateScreen';
import { GroupHubScreen } from './GroupHubScreen';
import { GroupMembersScreen } from './GroupMembersScreen';
import { GroupInvitesScreen } from './GroupInvitesScreen';
import { GroupRequestsScreen } from './GroupRequestsScreen';
import { GroupSettingsScreen } from './GroupSettingsScreen';
import { GroupsHomeScreen } from './GroupsHomeScreen';
import { LiveRoomScreen } from './LiveRoomScreen';
import { AlbumDetailScreen } from './AlbumDetailScreen';

export type GroupsStackParamList = {
  GroupsHome: undefined;
  GroupCreate: { organizationId: string };
  GroupHub: { groupId: string };
  GroupMembers: { groupId: string };
  GroupRequests: { groupId: string };
  GroupInvites: { groupId: string };
  GroupSettings: { groupId: string };
  AlbumDetail: { groupId: string; albumId: string };
  LiveRoom: { groupId: string; sessionId: string; serverUrl: string; token: string; host: boolean };
};

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export function GroupsStack() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={{ header: AppStackHeader }}>
      <Stack.Screen name="GroupsHome" component={GroupsHomeScreen} options={{ title: t('ui.headers.groups') }} />
      <Stack.Screen name="GroupCreate" component={GroupCreateScreen} options={{ title: t('ui.actions.create') }} />
      <Stack.Screen name="GroupHub" component={GroupHubScreen} options={{ title: t('ui.headers.group') }} />
      <Stack.Screen name="GroupMembers" component={GroupMembersScreen} options={{ title: t('ui.groups.membersTitle') }} />
      <Stack.Screen name="GroupRequests" component={GroupRequestsScreen} options={{ title: t('ui.groups.requests') }} />
      <Stack.Screen name="GroupInvites" component={GroupInvitesScreen} options={{ title: t('ui.groups.invites') }} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} options={{ title: t('ui.groups.settings') }} />
      <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} options={{ title: t('ui.groups.album') }} />
      <Stack.Screen name="LiveRoom" component={LiveRoomScreen} options={{ title: t('ui.groups.live') }} />
    </Stack.Navigator>
  );
}
