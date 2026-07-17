import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getGroup, updateGroup } from '../../shared/api/groups.api';
import { AppButton, AppField, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing } from '../../shared/ui/design-tokens';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupSettings'>;

export function GroupSettingsScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const groupQuery = useQuery({ queryKey: ['groups', 'detail', route.params.groupId], queryFn: () => getGroup(route.params.groupId) });
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [privacy, setPrivacy] = useState<'Open' | 'Closed' | 'Secret'>('Open');
  useEffect(() => { if (groupQuery.data) { setName(groupQuery.data.name); setDescription(groupQuery.data.description ?? ''); setPrivacy(groupQuery.data.groupPrivacy as 'Open' | 'Closed' | 'Secret'); } }, [groupQuery.data]);
  const save = useMutation({ mutationFn: () => updateGroup(route.params.groupId, { name: name.trim(), description: description.trim() || undefined, groupPrivacy: privacy }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['groups'] }); navigation.goBack(); }, onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message) });
  if (groupQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  if (!groupQuery.data?.canManage) return <AppScreen><AppState kind="error" title={t('ui.admin.notAuthorized')} /></AppScreen>;
  return <AppScreen scroll contentStyle={styles.content}><AppField label={t('ui.fields.groupName')} value={name} onChangeText={setName} /><AppField label={t('ui.fields.groupDescription')} value={description} onChangeText={setDescription} multiline />{(['Open', 'Closed', 'Secret'] as const).map((value) => <AppButton key={value} label={t(`ui.groups.${value.toLowerCase()}`)} variant={privacy === value ? 'primary' : 'secondary'} onPress={() => setPrivacy(value)} />)}<AppButton label={t('ui.actions.save')} onPress={() => save.mutate()} loading={save.isPending} disabled={!name.trim()} /></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md } });
