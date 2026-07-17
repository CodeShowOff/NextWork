import React, { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createConversation } from '../../../shared/api/messages.api';
import { searchAll } from '../../../shared/api/search.api';
import { useSessionStore } from '../../../shared/session/session.store';
import { AppAvatar, AppButton, AppCard, AppField, AppListRow, AppScreen, AppState } from '../../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../../shared/ui/design-tokens';
import { Conversation } from '../types';
import { useConversations, upsertConversation } from '../hooks/useConversations';
import { MessagesStackParamList } from './MessagesStack';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>;

export function ConversationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const myUserId = useSessionStore((state) => state.userId);
  const [peopleQuery, setPeopleQuery] = useState('');
  const conversationsQuery = useConversations();
  const peopleSearch = useQuery({
    queryKey: ['search', 'message-people', peopleQuery.trim()],
    queryFn: () => searchAll({ query: peopleQuery.trim(), limit: 8, scope: 'users' }),
    enabled: peopleQuery.trim().length >= 2,
  });
  const createDirect = useMutation({
    mutationFn: (userId: string) => createConversation({ type: 'direct', participantIds: [userId] }),
    onSuccess: (conversation) => {
      upsertConversation(queryClient, conversation);
      setPeopleQuery('');
      navigation.navigate('ConversationDetail', { conversationId: conversation.id });
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const conversations = useMemo(() => conversationsQuery.data?.pages.flatMap((page) => page.items) ?? [], [conversationsQuery.data]);

  if (!myUserId) return <AppScreen><AppState kind="empty" title={t('ui.messages.sessionRequired')} /></AppScreen>;

  return (
    <AppScreen contentStyle={styles.fill}>
      <FlatList<Conversation>
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <AppCard>
              <Text style={[styles.helper, { color: colors.textMuted }]}>{t('ui.messages.selectPerson')}</Text>
              <AppField value={peopleQuery} onChangeText={setPeopleQuery} placeholder={t('ui.fields.messagePeople')} accessibilityLabel={t('ui.fields.messagePeople')} autoCapitalize="none" />
              {peopleSearch.isFetching ? <AppState kind="loading" title={t('ui.states.loading')} /> : null}
              {(peopleSearch.data?.users ?? []).filter((person) => person.id !== myUserId).map((person) => (
                <AppListRow key={person.id} title={person.displayName} subtitle={person.email} leading={<AppAvatar name={person.displayName} />} trailing={<AppButton label={t('ui.actions.message')} loading={createDirect.isPending} onPress={() => createDirect.mutate(person.id)} />} />
              ))}
            </AppCard>
          </View>
        }
        renderItem={({ item }) => {
          const other = item.type === 'direct' ? item.participants.find((participant) => participant.userId !== myUserId) : null;
          const title = other?.displayName ?? item.participants.map((participant) => participant.displayName).join(', ');
          return <AppCard style={styles.card}><AppListRow title={title || t('ui.messages.selectPerson')} subtitle={item.lastMessage?.body ?? t('messages.list.noMessagesYet')} leading={<AppAvatar name={title || '?'} />} onPress={() => navigation.navigate('ConversationDetail', { conversationId: item.id })} trailing={item.unreadCount ? <View style={[styles.badge, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontWeight: '800' }}>{item.unreadCount}</Text></View> : undefined} /></AppCard>;
        }}
        refreshing={conversationsQuery.isFetching}
        onRefresh={() => conversationsQuery.refetch()}
        onEndReached={() => { if (conversationsQuery.hasNextPage && !conversationsQuery.isFetchingNextPage) void conversationsQuery.fetchNextPage(); }}
        ListEmptyComponent={conversationsQuery.isLoading ? <AppState kind="loading" title={t('ui.states.loading')} /> : <AppState kind="empty" title={t('ui.states.emptyMessages')} />}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.xs, flexGrow: 1 },
  headerContent: { marginBottom: spacing.sm },
  helper: { lineHeight: 20 },
  card: { paddingVertical: 0 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
