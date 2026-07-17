import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, Linking, View, useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { BottomTabNavigationOptions, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { registerGlobals } from '@livekit/react-native';

import { AdminScreen } from '../features/admin/AdminScreen';
import { CommentReportsScreen } from '../features/admin/CommentReportsScreen';
import { AuthScreen } from '../features/auth/AuthScreen';
import { FeedStack } from '../features/feed/screens/FeedStack';
import { GroupsStack } from '../features/groups/GroupsStack';
import { useMessagesBadgeBridge } from '../features/messages/hooks/useMessagesBadgeBridge';
import { useMessagesBadgeStore } from '../features/messages/messages-badge.store';
import { MessagesStack } from '../features/messages/screens/MessagesStack';
import { useNotificationBadgeStore } from '../features/notifications/notification-badge.store';
import { useNotificationBadgeBridge } from '../features/notifications/hooks/useNotificationBadgeBridge';
import { usePushDeviceRegistration } from '../features/notifications/hooks/usePushDeviceRegistration';
import { NotificationsStack } from '../features/notifications/screens/NotificationsStack';
import { ProfileStack } from '../features/profile/screens/ProfileStack';
import { SearchScreen } from '../features/search/SearchScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { acceptInvite } from '../shared/api/invites.api';
import { switchOrganization } from '../shared/api/organizations.api';
import { i18n } from '../shared/i18n/i18n';
import { extractInviteToken } from '../shared/linking/invite-linking';
import { useInviteLinkStore } from '../shared/session/invite-link.store';
import { authSessionService } from '../shared/session/auth-session.service';
import { useSessionStore } from '../shared/session/session.store';
import { resolveAppTheme, useThemeStore } from '../shared/theme/theme.store';
import { useAppColors } from '../shared/ui/design-tokens';
import { AppStackHeader } from './AppStackHeader';

registerGlobals();

export type MainTabsParamList = {
  Feed: undefined;
  Groups: undefined;
  Messages: undefined;
  Notifications: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  Search: undefined;
  Profile: undefined;
  Settings: undefined;
  Admin: undefined;
  CommentReports: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient();

function InviteLinkBridge() {
  const { t } = useTranslation();
  const queryClientBridge = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const pendingInviteToken = useInviteLinkStore((state) => state.pendingInviteToken);
  const setPendingInviteToken = useInviteLinkStore((state) => state.setPendingInviteToken);
  const clearPendingInviteToken = useInviteLinkStore((state) => state.clearPendingInviteToken);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const token = extractInviteToken(url);
      if (token) setPendingInviteToken(token);
    };
    const subscription = Linking.addEventListener('url', handleUrl);
    void Linking.getInitialURL().then((url) => {
      const token = url ? extractInviteToken(url) : null;
      if (token) setPendingInviteToken(token);
    }).catch(() => undefined);
    return () => subscription.remove();
  }, [setPendingInviteToken]);

  useEffect(() => {
    if (!accessToken || !pendingInviteToken) return;
    void acceptInvite(pendingInviteToken)
      .then(async (result) => {
        await switchOrganization(result.organizationId).catch(() => undefined);
        clearPendingInviteToken();
        queryClientBridge.invalidateQueries({ queryKey: ['users', 'me'] });
        queryClientBridge.invalidateQueries({ queryKey: ['organizations', 'me'] });
        queryClientBridge.invalidateQueries({ queryKey: ['groups'] });
        Alert.alert(t('app.alerts.inviteAcceptedTitle'), t('app.alerts.inviteAcceptedBody'));
      })
      .catch((error) => Alert.alert(t('app.alerts.inviteAcceptFailedTitle'), (error as Error).message));
  }, [accessToken, clearPendingInviteToken, pendingInviteToken, queryClientBridge, t]);
  return null;
}

function MainTabs() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const unreadMessages = useMessagesBadgeStore((state) => state.unreadCount);
  const unreadNotifications = useNotificationBadgeStore((state) => state.unreadCount);
  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={({ route }: { route: { name: keyof MainTabsParamList } }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.tab, borderTopColor: colors.border },
        tabBarIcon: ({ color, size }: { color: string; size: number }) => {
          const iconByRoute: Record<keyof MainTabsParamList, keyof typeof MaterialIcons.glyphMap> = {
            Feed: 'home-filled', Groups: 'groups', Messages: 'chat-bubble-outline', Notifications: 'notifications-none',
          };
          return <MaterialIcons name={iconByRoute[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedStack} options={{ title: t('app.tabs.feed'), tabBarLabel: t('app.tabs.feed') }} />
      <Tab.Screen name="Groups" component={GroupsStack} options={{ title: t('app.tabs.groups'), tabBarLabel: t('app.tabs.groups') }} />
      <Tab.Screen name="Messages" component={MessagesStack} options={{ title: t('app.tabs.messages'), tabBarLabel: t('app.tabs.messages'), tabBarBadge: unreadMessages || undefined }} />
      <Tab.Screen name="Notifications" component={NotificationsStack} options={{ title: t('app.tabs.notifications'), tabBarLabel: t('app.tabs.notifications'), tabBarBadge: unreadNotifications || undefined }} />
    </Tab.Navigator>
  );
}

function AuthenticatedApp() {
  const { t } = useTranslation();
  useMessagesBadgeBridge();
  useNotificationBadgeBridge();
  usePushDeviceRegistration();
  return (
    <RootStack.Navigator screenOptions={{ header: AppStackHeader }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <RootStack.Screen name="Search" component={SearchScreen} options={{ title: t('ui.headers.search') }} />
      <RootStack.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
      <RootStack.Screen name="Settings" component={SettingsScreen} options={{ title: t('ui.headers.settings') }} />
      <RootStack.Screen name="Admin" component={AdminScreen} options={{ title: t('ui.headers.admin') }} />
      <RootStack.Screen name="CommentReports" component={CommentReportsScreen} options={{ title: t('ui.admin.commentReports') }} />
    </RootStack.Navigator>
  );
}

export default function App() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const accessToken = useSessionStore((state) => state.accessToken);
  const systemScheme = useColorScheme();
  const normalizedScheme = systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : null;
  const themePreference = useThemeStore((state) => state.preference);
  const appTheme = resolveAppTheme(themePreference, normalizedScheme);

  useEffect(() => { void authSessionService.hydrateSessionFromStorage(); }, []);

  if (!hydrated) {
    return <SafeAreaProvider><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" /></View></SafeAreaProvider>;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <InviteLinkBridge />
          <NavigationContainer theme={appTheme}>{accessToken ? <AuthenticatedApp /> : <AuthScreen />}</NavigationContainer>
        </I18nextProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
