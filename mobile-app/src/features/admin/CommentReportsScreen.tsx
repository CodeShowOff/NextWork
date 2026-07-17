import React from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { listCommentReports, resolveCommentReport } from '../../shared/api/comments.api';
import { AppButton, AppCard, AppListRow, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';

export function CommentReportsScreen() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const queryClient = useQueryClient();
  const reportsQuery = useQuery({ queryKey: ['comments', 'reports', 'open'], queryFn: () => listCommentReports({ limit: 50, status: 'open' }) });
  const resolve = useMutation({ mutationFn: ({ reportId, action }: { reportId: string; action: 'dismiss' | 'remove_comment' }) => resolveCommentReport(reportId, action), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', 'reports'] }), onError: (error) => Alert.alert(t('ui.states.errorTitle'), (error as Error).message) });
  if (reportsQuery.isLoading) return <AppScreen><AppState kind="loading" title={t('ui.states.loading')} /></AppScreen>;
  if (reportsQuery.isError) return <AppScreen><AppState kind="error" title={t('ui.states.errorTitle')} body={t('ui.states.errorBody')} action={{ label: t('ui.actions.retry'), onPress: () => reportsQuery.refetch() }} /></AppScreen>;
  return <AppScreen scroll contentStyle={styles.content}>{(reportsQuery.data?.items ?? []).map((report) => <AppCard key={report.id}><AppListRow title={t('ui.admin.reportReason', { reason: report.reason })} subtitle={report.comment.body} /><Text style={{ color: colors.textMuted }}>{t('ui.admin.reportedBy', { name: report.reporter.displayName })}</Text><AppButton label={t('ui.admin.dismissReport')} variant="secondary" onPress={() => resolve.mutate({ reportId: report.id, action: 'dismiss' })} loading={resolve.isPending} /><AppButton label={t('ui.admin.removeComment')} variant="danger" onPress={() => resolve.mutate({ reportId: report.id, action: 'remove_comment' })} disabled={resolve.isPending} /></AppCard>)}{!(reportsQuery.data?.items ?? []).length ? <AppState kind="empty" title={t('ui.admin.noReports')} /> : null}</AppScreen>;
}

const styles = StyleSheet.create({ content: { gap: spacing.sm } });
