import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { registerGlobals } from '@livekit/react-native';

import { i18n } from '../shared/i18n/i18n';
import { acceptInvite } from '../shared/api/invites.api';
import { switchOrganization } from '../shared/api/organizations.api';
import { getCurrentUser } from '../shared/api/users.api';
import { getStarterGroupsConfig } from '../shared/api/groups.api';
import { extractInviteToken } from '../shared/linking/invite-linking';
import { useInviteLinkStore } from '../shared/session/invite-link.store';
import { authSessionService } from '../shared/session/auth-session.service';
import { useSessionStore } from '../shared/session/session.store';
import { resolveAppTheme, useThemeStore } from '../shared/theme/theme.store';
import { radius, spacing, useAppColors } from '../shared/ui/design-tokens';
import { useMessagesBadgeBridge } from '../features/messages/hooks/useMessagesBadgeBridge';
import { useMessagesBadgeStore } from '../features/messages/messages-badge.store';
import { useNotificationBadgeBridge } from '../features/notifications/hooks/useNotificationBadgeBridge';
import { useNotificationBadgeStore } from '../features/notifications/notification-badge.store';
import { usePushDeviceRegistration } from '../features/notifications/hooks/usePushDeviceRegistration';
import { ToastProvider, useToast } from '../presentation/feedback';
import { useAdaptiveLayout } from '../presentation/layout';
import { NetworkProvider } from '../presentation/resilience';
import { AuthExperience } from '../experience/AuthExperience';
import { OnboardingExperience } from '../experience/OnboardingExperience';
import { HomeExperience, PostDetailExperience } from '../experience/HomeExperience';
import {
  GroupHubExperience,
  GroupMembersExperience,
  GroupSettingsExperience,
  GroupsExperience,
} from '../experience/GroupsExperience';
import { ConversationExperience, MessagesExperience } from '../experience/MessagesExperience';
import {
  AdminExperience,
  CommentReportsExperience,
  MenuExperience,
  NotificationsExperience,
  PreviewExperience,
  ProfileExperience,
  SearchExperience,
  SettingsExperience,
} from '../experience/SecondaryExperience';
import { LiveRoomExperience } from '../experience/LiveRoomExperience';
import { MainTabsParamList, RootStackParamList } from '../experience/navigation';

export type { MainTabsParamList, RootStackParamList } from '../experience/navigation';

registerGlobals();

const Tab = createBottomTabNavigator<MainTabsParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 2, refetchOnWindowFocus: true } },
});

const tabIcons: Record<keyof MainTabsParamList, keyof typeof MaterialIcons.glyphMap> = {
  Home: 'home-filled',
  Groups: 'groups',
  Chats: 'chat-bubble-outline',
  Notifications: 'notifications-none',
  Menu: 'menu',
};

const tabLabels: Record<keyof MainTabsParamList, string> = {
  Home: 'Home',
  Groups: 'Groups',
  Chats: 'Chats',
  Notifications: 'Alerts',
  Menu: 'Menu',
};

function AdaptiveTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useAppColors();
  const layout = useAdaptiveLayout();
  const insets = useSafeAreaInsets();
  const messages = useMessagesBadgeStore((store) => store.unreadCount);
  const notifications = useNotificationBadgeStore((store) => store.unreadCount);
  const badgeByRoute: Partial<Record<keyof MainTabsParamList, number>> = {
    Chats: messages,
    Notifications: notifications,
  };
  return (
    <View
      style={[
        styles.tabBar,
        layout.isCompact ? styles.tabBarCompact : styles.tabBarRail,
        {
          backgroundColor: colors.tab,
          borderColor: colors.border,
          paddingBottom: layout.isCompact ? Math.max(insets.bottom, spacing.xs) : spacing.md,
          paddingTop: layout.isCompact ? spacing.xs : Math.max(insets.top, spacing.md),
        },
      ]}
    >
      {state.routes.map((route: { key: string; name: string }, index: number) => {
        const focused = state.index === index;
        const routeName = route.name as keyof MainTabsParamList;
        const options = descriptors[route.key]?.options;
        const label =
          typeof options?.tabBarLabel === 'string' ? options.tabBarLabel : tabLabels[routeName];
        const badge = badgeByRoute[routeName];
        return (
          <Pressable
            key={route.key}
            testID={`tab-${routeName.toLowerCase()}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={({ pressed }) => [
              styles.tabItem,
              layout.isCompact ? styles.tabItemCompact : styles.tabItemRail,
              {
                backgroundColor: focused
                  ? colors.primarySoft
                  : pressed
                    ? colors.surfaceMuted
                    : 'transparent',
              },
            ]}
          >
            <View style={styles.tabIconWrap}>
              <MaterialIcons
                name={tabIcons[routeName]}
                size={22}
                color={focused ? colors.primary : colors.tabInactive}
              />
              {badge ? (
                <View style={[styles.tabBadge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.tabLabel, { color: focused ? colors.primary : colors.tabInactive }]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function MainTabs() {
  const layout = useAdaptiveLayout();
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props: BottomTabBarProps) => <AdaptiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarPosition: layout.isCompact ? 'bottom' : 'left',
      }}
    >
      <Tab.Screen name="Home">
        {({ navigation }: { navigation: any }) => (
          <HomeExperience navigation={navigation} route={{ key: 'Home', name: 'Main' } as any} />
        )}
      </Tab.Screen>
      <Tab.Screen name="Groups">
        {({ navigation }: { navigation: any }) => (
          <GroupsExperience
            navigation={navigation}
            route={{ key: 'Groups', name: 'Main' } as any}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Chats">
        {({ navigation }: { navigation: any }) => (
          <MessagesExperience
            navigation={navigation}
            route={{ key: 'Chats', name: 'Main' } as any}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Notifications">
        {({ navigation }: { navigation: any }) => (
          <NotificationsExperience
            navigation={navigation}
            route={{ key: 'Notifications', name: 'Main' } as any}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Menu">
        {({ navigation }: { navigation: any }) => (
          <MenuExperience navigation={navigation} route={{ key: 'Menu', name: 'Main' } as any} />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function InviteLinkBridge() {
  const { showToast } = useToast();
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
    void Linking.getInitialURL()
      .then((url) => {
        const token = url ? extractInviteToken(url) : null;
        if (token) setPendingInviteToken(token);
      })
      .catch(() => undefined);
    return () => subscription.remove();
  }, [setPendingInviteToken]);
  useEffect(() => {
    if (!accessToken || !pendingInviteToken) return;
    void acceptInvite(pendingInviteToken)
      .then(async (result) => {
        await switchOrganization(result.organizationId).catch(() => undefined);
        clearPendingInviteToken();
        await Promise.all([
          queryClientBridge.invalidateQueries({ queryKey: ['users', 'me'] }),
          queryClientBridge.invalidateQueries({ queryKey: ['organizations', 'me'] }),
          queryClientBridge.invalidateQueries({ queryKey: ['groups'] }),
        ]);
        showToast({
          tone: 'success',
          message: 'Invitation accepted. You have joined the organization.',
        });
      })
      .catch((error) =>
        showToast({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Could not accept invitation.',
        }),
      );
  }, [accessToken, clearPendingInviteToken, pendingInviteToken, queryClientBridge, showToast]);
  return null;
}

function AuthenticatedNavigator() {
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  useMessagesBadgeBridge();
  useNotificationBadgeBridge();
  usePushDeviceRegistration();
  const organizationId = meQuery.data?.activeOrganizationId;
  const onboardingQuery = useQuery({
    queryKey: ['groups', 'onboarding', organizationId],
    queryFn: () => getStarterGroupsConfig(organizationId as string),
    enabled: Boolean(organizationId) && !onboardingDismissed,
    retry: false,
  });
  if (meQuery.isLoading) return <LoadingSplash />;
  if (organizationId && onboardingQuery.isLoading) return <LoadingSplash />;
  if (
    organizationId &&
    onboardingQuery.data &&
    !onboardingQuery.data.onboardingCompleted &&
    !onboardingDismissed
  ) {
    return (
      <OnboardingExperience
        organizationId={organizationId}
        onComplete={() => setOnboardingDismissed(true)}
      />
    );
  }
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Search" component={SearchExperience} />
      <Stack.Screen name="PostDetail" component={PostDetailExperience} />
      <Stack.Screen name="Profile" component={ProfileExperience} />
      <Stack.Screen name="Conversation" component={ConversationExperience} />
      <Stack.Screen name="GroupHub" component={GroupHubExperience} />
      <Stack.Screen name="GroupMembers" component={GroupMembersExperience} />
      <Stack.Screen name="GroupSettings" component={GroupSettingsExperience} />
      <Stack.Screen
        name="LiveRoom"
        component={LiveRoomExperience}
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen name="Settings" component={SettingsExperience} />
      <Stack.Screen name="Admin" component={AdminExperience} />
      <Stack.Screen name="CommentReports" component={CommentReportsExperience} />
      <Stack.Screen name="Preview" component={PreviewExperience} />
    </Stack.Navigator>
  );
}

function LoadingSplash() {
  const colors = useAppColors();
  return (
    <View style={[styles.splash, { backgroundColor: colors.background }]}>
      <View style={[styles.splashMark, { backgroundColor: colors.accent }]}>
        <Text style={[styles.splashLetter, { color: colors.onAccent }]}>W</Text>
      </View>
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

function AppRoot() {
  const hydrated = useSessionStore((state) => state.hydrated);
  const accessToken = useSessionStore((state) => state.accessToken);
  const preference = useThemeStore((state) => state.preference);
  const rawSystemScheme = useColorScheme();
  const systemScheme =
    rawSystemScheme === 'light' || rawSystemScheme === 'dark' ? rawSystemScheme : null;
  const theme = useMemo(
    () => resolveAppTheme(preference, systemScheme),
    [preference, systemScheme],
  );
  useEffect(() => {
    void authSessionService.hydrateSessionFromStorage();
  }, []);
  if (!hydrated) return <LoadingSplash />;
  return (
    <NavigationContainer theme={theme}>
      {accessToken ? <AuthenticatedNavigator /> : <AuthExperience />}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <NetworkProvider>
            <ToastProvider>
              <StatusBar style="auto" translucent />
              <InviteLinkBridge />
              <AppRoot />
            </ToastProvider>
          </NetworkProvider>
        </I18nextProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  splashMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLetter: { fontSize: 32, lineHeight: 38, fontWeight: '900' },
  tabBar: {
    borderColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRightWidth: 0,
    zIndex: 20,
  },
  tabBarCompact: {
    minHeight: 66,
    paddingHorizontal: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabBarRail: {
    width: 98,
    borderTopWidth: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  tabItem: {
    minWidth: 0,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabItemCompact: { flex: 1, maxWidth: 94 },
  tabItemRail: { marginHorizontal: spacing.xs, minHeight: 62 },
  tabIconWrap: {
    position: 'relative',
    width: 26,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeText: { color: '#FFFFFF', fontSize: 8, lineHeight: 10, fontWeight: '900' },
  tabLabel: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
});
