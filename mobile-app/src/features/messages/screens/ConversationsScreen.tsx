import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { MaterialIcons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Conversation } from '../types';
import { useConversations, upsertConversation } from '../hooks/useConversations';
import { ConversationListItem } from '../components/ConversationListItem';
import { createConversation } from '../../../shared/api/messages.api';
import { authSessionService } from '../../../shared/session/auth-session.service';
import { useSessionStore } from '../../../shared/session/session.store';
import { featureFlags } from '../../../shared/config/runtime';
import { MessagesStackParamList } from './MessagesStack';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>;

export function ConversationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [directUserId, setDirectUserId] = useState('');
  const [sessionUserId, setSessionUserId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [realtimeBaseUrl, setRealtimeBaseUrl] = useState('');

  const setSession = useSessionStore((state) => state.setSession);
  const storeUserId = useSessionStore((state) => state.userId);
  const storeToken = useSessionStore((state) => state.accessToken);

  const hasSession = Boolean(storeUserId && storeToken);

  const conversationsQuery = useConversations();

  const items = useMemo(
    () => conversationsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [conversationsQuery.data],
  );
  const ConversationsListComponent = featureFlags.flashListRendering ? FlashList : FlatList;
  const keyExtractor = useCallback((item: Conversation) => item.id, []);
  const renderConversationItem = useCallback(
    ({ item }: { item: Conversation }) => (
      <ConversationListItem
        conversation={item}
        onPress={() => navigation.navigate('ConversationDetail', { conversationId: item.id })}
      />
    ),
    [navigation],
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
      Alert.alert(t('messages.alerts.createConversationFailed'), (error as Error).message);
    },
  });

  if (!hasSession) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.sessionCard}>
          <Text style={styles.sessionTitle}>{t('messages.setup.title')}</Text>
          <Text style={styles.helperText}>
            {t('messages.setup.helper')}
          </Text>
          <TextInput
            value={sessionUserId}
            onChangeText={setSessionUserId}
            placeholder={t('messages.setup.placeholders.userId')}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={sessionToken}
            onChangeText={setSessionToken}
            placeholder={t('messages.setup.placeholders.accessToken')}
            style={[styles.input, styles.tokenInput]}
            autoCapitalize="none"
            multiline
          />
          <TextInput
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            placeholder={t('messages.setup.placeholders.apiBaseUrl')}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={realtimeBaseUrl}
            onChangeText={setRealtimeBaseUrl}
            placeholder={t('messages.setup.placeholders.realtimeUrl')}
            style={styles.input}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              if (!sessionUserId.trim() || !sessionToken.trim()) {
                Alert.alert(
                  t('messages.alerts.missingFieldsTitle'),
                  t('messages.alerts.missingFieldsBody'),
                );
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
            <Text style={styles.primaryButtonText}>{t('messages.setup.saveSession')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.toolbar}>
        <View style={styles.composeRow}>
          <View style={styles.composeIconCircle}>
            <MaterialIcons name="chat" size={20} color="#2563EB" />
          </View>
          <TextInput
            value={directUserId}
            onChangeText={setDirectUserId}
            placeholder={t('messages.toolbar.directPlaceholder')}
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
            <Text style={styles.primaryButtonText}>{t('messages.toolbar.start')}</Text>
          </Pressable>
        </View>
        <View style={styles.toolbarBottomRow}>
          <MaterialIcons name="forum" size={20} color="#9CA3AF" />
          <Pressable
            onPress={async () => {
              await authSessionService.logout();
            }}
          >
            <Text style={styles.secondaryLink}>{t('messages.toolbar.signOut')}</Text>
          </Pressable>
        </View>
      </View>

      {conversationsQuery.isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0B6E4F" />
        </View>
      ) : (
        <ConversationsListComponent<Conversation>
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderConversationItem}
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
              <Text style={styles.helperText}>{t('messages.list.empty')}</Text>
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
    backgroundColor: '#ECECEC',
  },
  toolbar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  composeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  composeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
  },
  tokenInput: {
    minHeight: 90,
  },
  primaryButton: {
    backgroundColor: '#1877F2',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 40,
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
    textAlign: 'center',
  },
  secondaryLink: {
    color: '#2563EB',
    fontWeight: '600',
  },
});
