import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getProfile, updateMyProfile } from '../../../shared/api/profiles.api';
import { getCurrentUser } from '../../../shared/api/users.api';
import { AppButton, AppField, AppScreen, AppState } from '../../../shared/ui/AppUI';
import { spacing } from '../../../shared/ui/design-tokens';

export function EditProfileScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const profileQuery = useQuery({ queryKey: ['profiles', meQuery.data?.id], queryFn: () => getProfile(meQuery.data!.id), enabled: Boolean(meQuery.data?.id) });
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  useEffect(() => { if (profileQuery.data) { setDisplayName(profileQuery.data.displayName); setBio(profileQuery.data.bio ?? ''); setJobTitle(profileQuery.data.jobTitle ?? ''); } }, [profileQuery.data]);
  const save = useMutation({
    mutationFn: () => updateMyProfile({ displayName: displayName.trim(), bio: bio.trim() || undefined, jobTitle: jobTitle.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profiles', meQuery.data?.id] }); navigation.goBack(); },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  if (profileQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  return <AppScreen scroll contentStyle={styles.content}><AppField label={t('profile.placeholders.displayName')} value={displayName} onChangeText={setDisplayName} /><AppField label={t('profile.placeholders.jobTitle')} value={jobTitle} onChangeText={setJobTitle} /><AppField label={t('profile.placeholders.bio')} value={bio} onChangeText={setBio} multiline /><AppButton label={t('ui.actions.save')} onPress={() => save.mutate()} loading={save.isPending} disabled={!displayName.trim()} /></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md } });
