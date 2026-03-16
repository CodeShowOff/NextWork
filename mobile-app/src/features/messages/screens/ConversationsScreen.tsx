import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Conversation } from '../types';
import { useConversations, upsertConversation } from '../hooks/useConversations';
import { ConversationListItem } from '../components/ConversationListItem';
import { createConversation } from '../../../shared/api/messages.api';
import { useSessionStore } from '../../../shared/session/session.store';
import { MessagesStackParamList } from './MessagesStack';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>;

export function ConversationsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [directUserId, setDirectUserId] = useState('');
  const [sessionUserId, setSessionUserId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [realtimeBaseUrl, setRealtimeBaseUrl] = useState('');

  const setSession = useSessionStore((state) => state.setSession);
  const clearSession = useSessionStore((state) => state.clearSession);
  const storeUserId = useSessionStore((state) => state.userId);
  const storeToken = useSessionStore((state) => state.accessToken);

  const hasSession = Boolean(storeUserId && storeToken);

  const conversationsQuery = useConversations();

  const items = useMemo(
    () => conversationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [conversationsQuery.data],
  );

  const createDirectMutation = useMutation({
    mutationFn: async (targetUserId: string) =>
      createConversation({
        type: 'direct',
        participantIds: [targetUserId],
      }),
    onSuccess: (conversation) => {
      upsertConversation(queryClient, conversation);
      setDirectUserId('');
      navigation.navigate('ConversationDetail', {
        conversationId: conversation.id,
      });
    },
    onError: (error) => {
      Alert.alert('Could not create conversation', (error as Error).message);
    },
  });

  if (!hasSession) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.sessionCard}>
          <Text style={styles.sessionTitle}>Messaging setup</Text>
          <Text style={styles.helperText}>
            Enter your access token and user ID from backend auth endpoints to start messaging.
          </Text>
          <TextInput
            value={sessionUserId}
            onChangeText={setSessionUserId}
            placeholder="User ID"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={sessionToken}
            onChangeText={setSessionToken}
            placeholder="Access token"
            style={[styles.input, styles.tokenInput]}
            autoCapitalize="none"
            multiline
          />
          <TextInput
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            placeholder="API base URL (optional)"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={realtimeBaseUrl}
            onChangeText={setRealtimeBaseUrl}
            placeholder="Realtime URL (optional)"
            style={styles.input}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (!sessionUserId.trim() || !sessionToken.trim()) {
                Alert.alert('Missing fields', 'User ID and access token are required.');
                return;
              }

              setSession({
                userId: sessionUserId.trim(),
                accessToken: sessionToken.trim(),
                apiBaseUrl: apiBaseUrl.trim(),
                realtimeBaseUrl: realtimeBaseUrl.trim(),
              });
            }}
          >
            <Text style={styles.primaryButtonText}>Save session</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.composeRow}>
          <TextInput
            value={directUserId}
            onChangeText={setDirectUserId}
            placeholder="Start direct chat with user ID"
            autoCapitalize="none"
            style={[styles.input, styles.composeInput]}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              const target = directUserId.trim();
              if (!target) {
                return;
              }

              createDirectMutation.mutate(target);
            }}
          >
            <Text style={styles.primaryButtonText}>Start</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            clearSession();
          }}
        >
          <Text style={styles.secondaryLink}>Sign out</Text>
        </Pressable>
      </View>

      {conversationsQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0B6E4F" />
        </View>
      ) : (
        <FlatList<Conversation>
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationListItem
              conversation={item}
              onPress={() => navigation.navigate('ConversationDetail', { conversationId: item.id })}
            />
          )}
          onEndReached={() => {
            if (conversationsQuery.hasNextPage && !conversationsQuery.isFetchingNextPage) {
              conversationsQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            conversationsQuery.isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#0B6E4F" style={styles.footerSpinner} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.helperText}>No conversations yet. Start one above.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  toolbar: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  composeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  composeInput: {
    flex: 1,
    marginBottom: 0,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  footerSpinner: {
    marginVertical: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  tokenInput: {
    minHeight: 90,
  },
  primaryButton: {
    backgroundColor: '#0B6E4F',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  sessionCard: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  sessionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  helperText: {
    color: '#475569',
    lineHeight: 20,
    marginBottom: 10,
  },
  secondaryLink: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
});
