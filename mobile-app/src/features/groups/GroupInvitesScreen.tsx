import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createGroupInvitation } from '../../shared/api/groups.api';
import { searchAll } from '../../shared/api/search.api';
import { AppAvatar, AppButton, AppCard, AppField, AppListRow, AppScreen } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupInvites'>;

export function GroupInvitesScreen({ route }: Props) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const [query, setQuery] = useState('');
  const peopleQuery = useQuery({ queryKey: ['search', 'group-invites', query.trim()], queryFn: () => searchAll({ query: query.trim(), scope: 'users', limit: 12 }), enabled: query.trim().length >= 2 });
  const invite = useMutation({ mutationFn: (userId: string) => createGroupInvitation(route.params.groupId, userId), onSuccess: () => { setQuery(''); Alert.alert(t('ui.groups.invitedTitle'), t('ui.groups.invitedBody')); }, onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message) });
  return <AppScreen scroll contentStyle={styles.content}><Text style={{ color: colors.textMuted }}>{t('ui.groups.invitePeople')}</Text><AppField value={query} onChangeText={setQuery} placeholder={t('ui.fields.messagePeople')} accessibilityLabel={t('ui.fields.messagePeople')} autoCapitalize="none" />{(peopleQuery.data?.users ?? []).map((person) => <AppCard key={person.id} style={styles.card}><AppListRow title={person.displayName} subtitle={person.email} leading={<AppAvatar name={person.displayName} />} trailing={<AppButton label={t('ui.groups.invite')} onPress={() => invite.mutate(person.id)} loading={invite.isPending} />}/></AppCard>)}</AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.sm }, card: { paddingVertical: 0 } });
