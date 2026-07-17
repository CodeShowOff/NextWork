import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { getProfile, replaceMySkills, searchSkills } from '../../../shared/api/profiles.api';
import { getCurrentUser } from '../../../shared/api/users.api';
import { AppButton, AppCard, AppField, AppScreen, AppState } from '../../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../../shared/ui/design-tokens';

export function SkillsScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const { t } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const profileQuery = useQuery({ queryKey: ['profiles', meQuery.data?.id], queryFn: () => getProfile(meQuery.data!.id), enabled: Boolean(meQuery.data?.id) });
  const [draft, setDraft] = useState('');
  const [skills, setSkills] = useState<string[] | null>(null);
  const values = skills ?? profileQuery.data?.skills.map((skill) => skill.name) ?? [];
  const suggestionsQuery = useQuery({ queryKey: ['skills', draft.trim()], queryFn: () => searchSkills(draft.trim()), enabled: draft.trim().length >= 2 });
  const suggestions = useMemo(() => (suggestionsQuery.data?.items ?? []).map((item) => item.name).filter((item) => !values.some((value) => value.toLowerCase() === item.toLowerCase())), [suggestionsQuery.data?.items, values]);
  const add = (value: string) => { const normalized = value.trim(); if (normalized && !values.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) setSkills([...values, normalized]); setDraft(''); };
  const save = useMutation({ mutationFn: () => replaceMySkills(values), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profiles', meQuery.data?.id] }); navigation.goBack(); }, onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message) });
  if (profileQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  return <AppScreen scroll contentStyle={styles.content}><AppField value={draft} onChangeText={setDraft} placeholder={t('ui.fields.skill')} accessibilityLabel={t('ui.fields.skill')} onSubmitEditing={() => add(draft)} /><AppButton label={t('ui.profile.addSkill')} variant="secondary" onPress={() => add(draft)} disabled={!draft.trim()} />{suggestions.map((suggestion) => <AppButton key={suggestion} label={suggestion} variant="ghost" onPress={() => add(suggestion)} />)}<AppCard><View style={styles.skills}>{values.map((skill) => <View key={skill} style={[styles.skill, { backgroundColor: colors.surfaceMuted }]}><Text style={{ color: colors.text }}>{skill}</Text><AppButton label={t('ui.actions.remove')} variant="ghost" onPress={() => setSkills(values.filter((item) => item !== skill))} /></View>)}</View></AppCard><AppButton label={t('ui.actions.save')} onPress={() => save.mutate()} loading={save.isPending} /></AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.md }, skills: { gap: spacing.xs }, skill: { borderRadius: 12, padding: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } });
