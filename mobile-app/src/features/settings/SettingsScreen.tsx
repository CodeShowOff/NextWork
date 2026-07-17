import React from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  getNotificationPreferences,
  listMutedNotificationUsers,
  unmuteNotificationUser,
  updateNotificationPreferences,
} from '../../shared/api/notifications.api';
import { listMyOrganizations, switchOrganization } from '../../shared/api/organizations.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { localeLabels, SupportedLocale, supportedLocales } from '../../shared/i18n/resources';
import { useLocaleStore } from '../../shared/i18n/locale.store';
import { authSessionService } from '../../shared/session/auth-session.service';
import { ThemePreference, useThemeStore } from '../../shared/theme/theme.store';
import { AppButton, AppCard, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';

export function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const theme = useThemeStore((state) => state.preference);
  const setTheme = useThemeStore((state) => state.setPreference);
  const preferencesQuery = useQuery({ queryKey: ['notifications', 'preferences'], queryFn: getNotificationPreferences });
  const mutedQuery = useQuery({ queryKey: ['notifications', 'muted-users'], queryFn: listMutedNotificationUsers });
  const meQuery = useQuery({ queryKey: ['users', 'me'], queryFn: getCurrentUser });
  const organizationsQuery = useQuery({ queryKey: ['organizations', 'me'], queryFn: listMyOrganizations });
  const updatePreferences = useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (value) => queryClient.setQueryData(['notifications', 'preferences'], value),
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const unmute = useMutation({
    mutationFn: unmuteNotificationUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'muted-users'] }),
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });
  const switchOrganizationMutation = useMutation({
    mutationFn: switchOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message),
  });

  return (
    <AppScreen contentStyle={styles.fill}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Section title={t('ui.settings.account')}>
          <AppButton label={t('ui.settings.signOut')} variant="danger" onPress={() => void authSessionService.logout()} />
        </Section>
        <Section title={t('ui.settings.organization')}>
          {organizationsQuery.isLoading || meQuery.isLoading ? <AppState kind="loading" title={t('ui.states.loading')} /> : null}
          {(organizationsQuery.data?.items ?? []).map((membership) => {
            const active = membership.organizationId === meQuery.data?.activeOrganizationId;
            const role = membership.role;
            const roleLabel = t(`ui.groups.role${role.slice(0, 1).toUpperCase()}${role.slice(1)}`);
            return <AppListRow key={membership.organizationId} title={membership.organization.name} subtitle={roleLabel} trailing={<AppButton label={active ? t('ui.settings.activeOrganization') : t('ui.settings.switchOrganization')} variant={active ? 'secondary' : 'primary'} disabled={active} loading={switchOrganizationMutation.isPending} onPress={() => switchOrganizationMutation.mutate(membership.organizationId)} />} />;
          })}
        </Section>
        <Section title={t('ui.settings.appearance')}>
          {(['system', 'light', 'dark'] as ThemePreference[]).map((value) => (
            <AppButton key={value} label={t(`ui.settings.theme${value.slice(0, 1).toUpperCase()}${value.slice(1)}`)} variant={theme === value ? 'primary' : 'secondary'} onPress={() => setTheme(value)} />
          ))}
        </Section>
        <Section title={t('ui.settings.language')}>
          {supportedLocales.map((value) => (
            <AppButton key={value} label={localeLabels[value]} variant={locale === value ? 'primary' : 'secondary'} onPress={() => setLocale(value as SupportedLocale)} />
          ))}
        </Section>
        <Section title={t('ui.settings.notifications')}>
          {preferencesQuery.isLoading ? <AppState kind="loading" title={t('ui.states.loading')} /> : null}
          {preferencesQuery.data ? (
            <View style={styles.rows}>
              {[
                ['likeEnabled', t('notifications.preferences.likes')],
                ['commentEnabled', t('notifications.preferences.comments')],
                ['followEnabled', t('notifications.preferences.follows')],
                ['messageEnabled', t('notifications.preferences.messages')],
              ].map(([key, label]) => {
                const preferenceKey = key as keyof typeof preferencesQuery.data;
                return (
                  <AppListRow
                    key={key}
                    title={label}
                    trailing={<Switch
                      value={Boolean(preferencesQuery.data[preferenceKey])}
                      onValueChange={(next) => updatePreferences.mutate({ [preferenceKey]: next })}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      accessibilityLabel={label}
                      accessibilityRole="switch"
                    />}
                  />
                );
              })}
            </View>
          ) : null}
        </Section>
        <Section title={t('ui.settings.mutedPeople')}>
          {mutedQuery.isLoading ? <AppState kind="loading" title={t('ui.states.loading')} /> : null}
          {(mutedQuery.data?.items ?? []).length ? (mutedQuery.data?.items ?? []).map((person) => (
            <AppListRow key={person.userId} title={person.displayName} trailing={<AppButton label={t('notifications.actions.unmute')} variant="secondary" onPress={() => unmute.mutate(person.userId)} />} />
          )) : <Text style={{ color: colors.textMuted }}>{t('ui.settings.noMutedPeople')}</Text>}
        </Section>
      </ScrollView>
    </AppScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useAppColors();
  return <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text><AppCard>{children}</AppCard></View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.lg, flexGrow: 1 },
  section: { gap: spacing.xs },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  rows: { gap: 0 },
});
