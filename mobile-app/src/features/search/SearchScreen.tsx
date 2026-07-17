import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getPost } from '../../shared/api/feed.api';
import { searchAll } from '../../shared/api/search.api';
import { AppAvatar, AppCard, AppField, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';

type Scope = 'all' | 'users' | 'groups' | 'posts';

export function SearchScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const navigation = useNavigation() as any;
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const searchQuery = useQuery({
    queryKey: ['search', debounced, scope],
    queryFn: () => searchAll({ query: debounced, scope, limit: 20 }),
    enabled: debounced.length > 0,
  });
  const openPost = async (postId: string) => {
    try {
      const post = await getPost(postId);
      navigation.navigate('MainTabs', { screen: 'Feed', params: { screen: 'PostDetail', params: { post } } });
    } catch (error) {
      Alert.alert(t('ui.states.errorTitle'), (error as Error).message);
    }
  };
  const data = searchQuery.data;
  const hasResults = Boolean(data && (data.users.length || data.groups.length || data.posts.length));
  return (
    <AppScreen contentStyle={styles.fill}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppField value={query} onChangeText={setQuery} placeholder={t('ui.states.searchHint')} accessibilityLabel={t('ui.fields.search')} autoCapitalize="none" autoCorrect={false} />
        <View style={styles.scopeRow} accessibilityRole="tablist">
          {(['all', 'users', 'groups', 'posts'] as Scope[]).map((value) => {
            const active = value === scope;
            return <Pressable key={value} onPress={() => setScope(value)} accessibilityRole="tab" accessibilityState={{ selected: active }} style={[styles.scope, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceMuted : colors.surface }]}><Text style={{ color: active ? colors.primary : colors.text, fontWeight: '700' }}>{t(`ui.search.${value}`)}</Text></Pressable>;
          })}
        </View>
        {!debounced ? <AppState kind="empty" title={t('ui.states.searchHint')} /> : null}
        {searchQuery.isLoading ? <AppState kind="loading" title={t('ui.states.loading')} /> : null}
        {searchQuery.isError ? <AppState kind="error" title={t('ui.states.errorTitle')} body={t('ui.states.errorBody')} action={{ label: t('ui.actions.retry'), onPress: () => searchQuery.refetch() }} /> : null}
        {debounced && !searchQuery.isLoading && !searchQuery.isError && !hasResults ? <AppState kind="empty" title={t('ui.states.noResults')} /> : null}
        {(data?.users ?? []).length ? <ResultSection title={t('ui.search.people')}>{data!.users.map((person) => <AppListRow key={person.id} title={person.displayName} subtitle={person.email} leading={<AppAvatar name={person.displayName} />} onPress={() => navigation.navigate('Profile', { screen: 'UserProfile', params: { userId: person.id } })} />)}</ResultSection> : null}
        {(data?.groups ?? []).length ? <ResultSection title={t('ui.search.groups')}>{data!.groups.map((group) => <AppListRow key={group.id} title={group.name} subtitle={group.description} leading={<AppAvatar name={group.name} />} onPress={() => navigation.navigate('MainTabs', { screen: 'Groups', params: { screen: 'GroupHub', params: { groupId: group.id } } })} />)}</ResultSection> : null}
        {(data?.posts ?? []).length ? <ResultSection title={t('ui.search.posts')}>{data!.posts.map((post) => <AppListRow key={post.id} title={post.author.displayName} subtitle={post.content} leading={<AppAvatar name={post.author.displayName} />} onPress={() => void openPost(post.id)} />)}</ResultSection> : null}
      </ScrollView>
    </AppScreen>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useAppColors();
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text><AppCard>{children}</AppCard></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  scopeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  scope: { minHeight: 38, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing.xs },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
});
