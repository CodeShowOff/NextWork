import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getStarterGroupsConfig, initializeStarterGroups } from '../shared/api/groups.api';
import { spacing, typography, useAppColors } from '../shared/ui/design-tokens';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  FeedSkeleton,
  SectionHeader,
} from '../presentation/components';
import { CenteredContent, Page } from '../presentation/layout';
import { useToast } from '../presentation/feedback';

export function OnboardingExperience({
  organizationId,
  onComplete,
}: {
  organizationId: string;
  onComplete: () => void;
}) {
  const colors = useAppColors();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const configQuery = useQuery({
    queryKey: ['groups', 'onboarding', organizationId],
    queryFn: () => getStarterGroupsConfig(organizationId),
  });
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (configQuery.data) setSelectedKeys(configQuery.data.selectedKeys);
  }, [configQuery.data]);

  useEffect(() => {
    if (configQuery.data?.onboardingCompleted) onComplete();
  }, [configQuery.data?.onboardingCompleted, onComplete]);

  const initialize = useMutation({
    mutationFn: (skipped: boolean) =>
      initializeStarterGroups({ organizationId, selectedKeys, skipped }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['groups'] });
      void queryClient.invalidateQueries({ queryKey: ['groups', 'onboarding', organizationId] });
      showToast({ tone: 'success', message: 'Your group space is ready.' });
      onComplete();
    },
    onError: (error) =>
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Unable to set up your starter groups.',
      }),
  });

  if (configQuery.isLoading)
    return (
      <Page>
        <CenteredContent>
          <FeedSkeleton count={2} />
        </CenteredContent>
      </Page>
    );
  if (configQuery.isError)
    return (
      <Page>
        <CenteredContent>
          <ErrorState
            title="We couldn’t set up your nextwork"
            onRetry={() => void configQuery.refetch()}
          />
        </CenteredContent>
      </Page>
    );
  if (!configQuery.data)
    return (
      <Page>
        <CenteredContent>
          <EmptyState
            title="No nextwork found"
            body="Sign in again or ask your administrator for an invitation."
          />
        </CenteredContent>
      </Page>
    );

  const config = configQuery.data;
  if (config.onboardingCompleted) {
    return null;
  }

  const toggle = (key: string) =>
    setSelectedKeys((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );

  return (
    <Page
      scroll
      contentStyle={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xl,
        paddingBottom: spacing.xxl,
      }}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <CenteredContent style={{ gap: spacing.md, maxWidth: 620, alignSelf: 'center' }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.overline, { color: colors.primary }]}>SET UP YOUR SPACE</Text>
          <Text accessibilityRole="header" style={[typography.display, { color: colors.text }]}>
            Start with the groups your team needs.
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            Choose a few useful spaces now. You can add, edit, and join groups anytime.
          </Text>
        </View>
        <Card raised>
          <SectionHeader title="Recommended groups" overline="Starter kit" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {config.catalog.map((group) => (
              <Chip
                key={group.key}
                label={group.name}
                selected={selectedKeys.includes(group.key)}
                onPress={() => toggle(group.key)}
                icon={selectedKeys.includes(group.key) ? 'check' : 'groups'}
              />
            ))}
          </View>
          {config.catalog.map((group) =>
            selectedKeys.includes(group.key) ? (
              <View key={`${group.key}-description`} style={{ gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{group.name}</Text>
                <Text style={{ color: colors.textMuted, lineHeight: 20 }}>{group.description}</Text>
              </View>
            ) : null,
          )}
        </Card>
        <View style={{ gap: spacing.sm }}>
          <Button
            label={
              selectedKeys.length
                ? `Create ${selectedKeys.length} starter ${selectedKeys.length === 1 ? 'group' : 'groups'}`
                : 'Continue without starter groups'
            }
            fullWidth
            onPress={() => initialize.mutate(false)}
            loading={initialize.isPending}
          />
          <Button
            label="Skip for now"
            fullWidth
            variant="ghost"
            onPress={() => initialize.mutate(true)}
            disabled={initialize.isPending}
          />
        </View>
      </CenteredContent>
    </Page>
  );
}
