import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthScreen } from '../features/auth/AuthScreen';
import { FeedStack } from '../features/feed/screens/FeedStack';
import { GroupsScreen } from '../features/groups/GroupsScreen';
import { useMessagesBadgeBridge } from '../features/messages/hooks/useMessagesBadgeBridge';
import { useMessagesBadgeStore } from '../features/messages/messages-badge.store';
import { MessagesStack } from '../features/messages/screens/MessagesStack';
import { useNotificationBadgeStore } from '../features/notifications/notification-badge.store';
import { useNotificationBadgeBridge } from '../features/notifications/hooks/useNotificationBadgeBridge';
import { NotificationsScreen } from '../features/notifications/screens/NotificationsScreen';
import { ProfileStack } from '../features/profile/screens/ProfileStack';
import { SearchScreen } from '../features/search/SearchScreen';
import { acceptInvite } from '../shared/api/invites.api';
import { switchOrganization } from '../shared/api/organizations.api';
import { extractInviteToken } from '../shared/linking/invite-linking';
import { useInviteLinkStore } from '../shared/session/invite-link.store';
import { useSessionStore } from '../shared/session/session.store';

const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

function InviteLinkBridge() {
  const queryClientBridge = useQueryClient();
  const accessToken = useSessionStore((state) => state.accessToken);
  const pendingInviteToken = useInviteLinkStore((state) => state.pendingInviteToken);
  const setPendingInviteToken = useInviteLinkStore((state) => state.setPendingInviteToken);
  const clearPendingInviteToken = useInviteLinkStore((state) => state.clearPendingInviteToken);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const token = extractInviteToken(url);
      if (token) {
        setPendingInviteToken(token);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL()
      .then((url) => {
        if (!url) {
          return;
        }

        const token = extractInviteToken(url);
        if (token) {
          setPendingInviteToken(token);
        }
      })
      .catch(() => {
        // Initial URL is optional.
      });

    return () => {
      subscription.remove();
    };
  }, [setPendingInviteToken]);

  useEffect(() => {
    if (!accessToken || !pendingInviteToken) {
      return;
    }

    acceptInvite(pendingInviteToken)
      .then(async (result) => {
        await switchOrganization(result.organizationId).catch(() => {
          // Some backends may already activate on accept; ignore explicit switch failure.
        });
        clearPendingInviteToken();
        queryClientBridge.invalidateQueries({ queryKey: ['users', 'me'] });
        queryClientBridge.invalidateQueries({ queryKey: ['organizations', 'me'] });
        queryClientBridge.invalidateQueries({ queryKey: ['groups'] });
        Alert.alert('Invite accepted', 'You have joined the organization and switched context.');
      })
      .catch((error) => {
        Alert.alert('Could not accept invite link', (error as Error).message);
      });
  }, [accessToken, clearPendingInviteToken, pendingInviteToken, queryClientBridge]);

  return null;
}

function AuthenticatedTabs() {
  const unreadMessages = useMessagesBadgeStore((state) => state.unreadCount);
  const unreadCount = useNotificationBadgeStore((state) => state.unreadCount);
  useMessagesBadgeBridge();
  useNotificationBadgeBridge();

  return (
    <Tab.Navigator>
      <Tab.Screen name="Feed" component={FeedStack} options={{ headerShown: false }} />
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        options={{
          headerShown: false,
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const accessToken = useSessionStore((state) => state.accessToken);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <InviteLinkBridge />
        <NavigationContainer>
          {accessToken ? <AuthenticatedTabs /> : <AuthScreen />}
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
