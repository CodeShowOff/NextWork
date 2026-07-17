import React, { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { createGroup } from '../../shared/api/groups.api';
import { AppButton, AppField, AppScreen } from '../../shared/ui/AppUI';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupCreate'>;

export function GroupCreateScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<'Open' | 'Closed' | 'Secret'>('Open');
  const createMutation = useMutation({
    mutationFn: () => createGroup({ organizationId: route.params.organizationId, name: name.trim(), description: description.trim() || undefined, groupPrivacy: privacy }),
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['groups', route.params.organizationId] });
      navigation.replace('GroupHub', { groupId: group.id });
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  return (
    <AppScreen scroll contentStyle={styles.content}>
      <AppField label={t('ui.fields.groupName')} value={name} onChangeText={setName} placeholder={t('ui.fields.groupName')} />
      <AppField label={t('ui.fields.groupDescription')} value={description} onChangeText={setDescription} placeholder={t('ui.fields.groupDescription')} multiline />
      {(['Open', 'Closed', 'Secret'] as const).map((value) => (
        <AppButton key={value} label={t(`ui.groups.${value.toLowerCase()}`)} onPress={() => setPrivacy(value)} variant={privacy === value ? 'primary' : 'secondary'} />
      ))}
      <AppButton label={t('ui.actions.create')} onPress={() => createMutation.mutate()} loading={createMutation.isPending} disabled={name.trim().length < 2} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({ content: { gap: 12 } });
