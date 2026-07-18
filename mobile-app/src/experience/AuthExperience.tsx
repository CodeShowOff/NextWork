import React, { useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  confirmPasswordReset,
  login,
  requestPasswordReset,
  resendVerification,
  signUp,
  verifyEmail,
} from '../shared/api/auth.api';
import { getCurrentUser } from '../shared/api/users.api';
import { defaultApiBaseUrl, defaultRealtimeBaseUrl } from '../shared/config/runtime';
import { authSessionService } from '../shared/session/auth-session.service';
import { useSessionStore } from '../shared/session/session.store';
import { radius, spacing, typography, useAppColors } from '../shared/ui/design-tokens';
import { Button, Card, Chip, IconButton, TextField } from '../presentation/components';
import { CenteredContent, Page } from '../presentation/layout';
import { useToast } from '../presentation/feedback';
import { useNetwork } from '../presentation/resilience';

type AuthMode = 'login' | 'signup' | 'verify' | 'forgot' | 'reset';

// Metro resolves bundled image assets at build time.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const heroImage = require('../../assets/images/group_company_announcements.jpg');

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.replace(/^Error:\s*/, '') : 'Please try again.';
}

export function AuthExperience() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const { showToast } = useToast();
  const { isOnline } = useNetwork();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationSize, setOrganizationSize] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [realtimeBaseUrl, setRealtimeBaseUrl] = useState('');
  const [showServer, setShowServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationHint, setVerificationHint] = useState<string | null>(null);

  const changeMode = (next: AuthMode) => {
    setError(null);
    setVerificationHint(null);
    setMode(next);
  };

  const establish = async () => {
    const prior = useSessionStore.getState();
    const effectiveApi = apiBaseUrl.trim() || prior.apiBaseUrl || defaultApiBaseUrl;
    const effectiveRealtime =
      realtimeBaseUrl.trim() || prior.realtimeBaseUrl || defaultRealtimeBaseUrl;
    useSessionStore.setState({ apiBaseUrl: effectiveApi, realtimeBaseUrl: effectiveRealtime });
    const tokens = await login({ email: email.trim(), password });
    useSessionStore
      .getState()
      .setSession({
        userId: 'pending',
        accessToken: tokens.accessToken,
        apiBaseUrl: effectiveApi,
        realtimeBaseUrl: effectiveRealtime,
      });
    const me = await getCurrentUser();
    await authSessionService.establishSession({
      userId: me.id,
      tokens,
      apiBaseUrl: effectiveApi,
      realtimeBaseUrl: effectiveRealtime,
    });
  };

  const submit = async () => {
    if (!isOnline) {
      setError('Connect to the internet to continue.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        if (!email.trim() || !password) throw new Error('Enter your email address and password.');
        await establish();
        return;
      }
      if (mode === 'signup') {
        if (
          ![email, password, fullName, organizationName, organizationSize, jobTitle].every(
            (value) => value.trim(),
          )
        ) {
          throw new Error('Complete all fields to create your nextwork.');
        }
        const result = await signUp({
          email: email.trim(),
          password,
          displayName: fullName.trim(),
          fullName: fullName.trim(),
          organizationName: organizationName.trim(),
          organizationSize: organizationSize.trim(),
          jobTitle: jobTitle.trim(),
        });
        setVerificationHint(
          result.debugCode
            ? `A verification code was sent. Development code: ${result.debugCode}`
            : 'A verification code was sent to your email.',
        );
        setToken('');
        setMode('verify');
        return;
      }
      if (mode === 'verify') {
        if (!email.trim() || !token.trim())
          throw new Error('Enter your email and verification code.');
        await verifyEmail({ email: email.trim(), token: token.trim() });
        showToast({ tone: 'success', message: 'Email verified. You can sign in now.' });
        setPassword('');
        setMode('login');
        return;
      }
      if (mode === 'forgot') {
        if (!email.trim()) throw new Error('Enter the email address for your account.');
        const result = await requestPasswordReset({ email: email.trim() });
        setVerificationHint(
          result.debugCode
            ? `A reset code was sent. Development code: ${result.debugCode}`
            : 'A reset code was sent to your email.',
        );
        setToken('');
        setMode('reset');
        return;
      }
      if (!email.trim() || !token.trim() || !newPassword || !confirmPassword)
        throw new Error('Complete every password-reset field.');
      if (newPassword !== confirmPassword) throw new Error('The new passwords do not match.');
      await confirmPasswordReset({ email: email.trim(), token: token.trim(), newPassword });
      showToast({ tone: 'success', message: 'Your password has been reset.' });
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMode('login');
    } catch (submitError) {
      await authSessionService.clearSession().catch(() => undefined);
      setError(errorMessage(submitError));
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'signup'
        ? 'Create your nextwork'
        : mode === 'verify'
          ? 'Verify your email'
          : mode === 'forgot'
            ? 'Reset your password'
            : 'Choose a new password';
  const subtitle =
    mode === 'login'
      ? 'Stay close to your team, wherever work happens.'
      : mode === 'signup'
        ? 'Set up a shared home for your people and teams.'
        : (verificationHint ?? 'We’ll help you get securely back into NextWork.');

  return (
    <Page scroll contentStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <CenteredContent style={styles.centered}>
        <ImageBackground
          source={heroImage}
          imageStyle={styles.heroImage}
          style={[styles.hero, { backgroundColor: colors.primary }]}
        >
          <View style={[styles.heroVeil, { backgroundColor: 'rgba(46, 16, 112, 0.46)' }]} />
          <View style={styles.brandRow}>
            <View style={[styles.brandMark, { backgroundColor: colors.accent }]}>
              <Text style={[styles.brandMarkText, { color: colors.onAccent }]}>W</Text>
            </View>
            <Text style={styles.brandName}>NextWork</Text>
          </View>
          <Text style={styles.heroTitle}>Work feels more connected here.</Text>
          <Text style={styles.heroText}>
            A calm, secure place for updates, groups, and everyday conversations.
          </Text>
        </ImageBackground>

        <Card raised style={styles.formCard}>
          <View style={styles.formHeading}>
            <Text accessibilityRole="header" style={[styles.formTitle, { color: colors.text }]}>
              {title}
            </Text>
            <Text style={[styles.formSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
          </View>

          {mode === 'login' || mode === 'signup' ? (
            <View style={styles.modeRow}>
              <Chip
                label="Sign in"
                selected={mode === 'login'}
                onPress={() => changeMode('login')}
              />
              <Chip
                label="Create account"
                selected={mode === 'signup'}
                onPress={() => changeMode('signup')}
              />
            </View>
          ) : (
            <Button
              label="Back to sign in"
              variant="ghost"
              onPress={() => changeMode('login')}
              style={styles.backButton}
            />
          )}

          {mode === 'signup' ? (
            <TextField
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              autoComplete="name"
              leadingIcon="person-outline"
            />
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            leadingIcon="mail-outline"
          />
          {mode === 'login' || mode === 'signup' ? (
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              leadingIcon="lock-outline"
            />
          ) : null}
          {mode === 'signup' ? (
            <>
              <TextField
                label="Organization name"
                value={organizationName}
                onChangeText={setOrganizationName}
                leadingIcon="business"
              />
              <TextField
                label="Organization size"
                value={organizationSize}
                onChangeText={setOrganizationSize}
                placeholder="For example, 50–100 people"
                leadingIcon="groups"
              />
              <TextField
                label="Your job title"
                value={jobTitle}
                onChangeText={setJobTitle}
                autoComplete="organization-title"
                leadingIcon="badge"
              />
            </>
          ) : null}
          {mode === 'verify' || mode === 'reset' ? (
            <TextField
              label={mode === 'verify' ? 'Verification code' : 'Reset code'}
              value={token}
              onChangeText={setToken}
              autoCapitalize="characters"
              autoCorrect={false}
              leadingIcon="vpn-key"
            />
          ) : null}
          {mode === 'reset' ? (
            <>
              <TextField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="new-password"
                leadingIcon="lock-reset"
              />
              <TextField
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="new-password"
                leadingIcon="lock"
              />
            </>
          ) : null}

          {error ? (
            <View
              accessibilityRole="alert"
              style={[
                styles.error,
                { backgroundColor: colors.surfaceTint, borderColor: colors.danger },
              ]}
            >
              <Text style={{ color: colors.danger, flex: 1 }}>{error}</Text>
              <IconButton icon="close" label="Dismiss error" onPress={() => setError(null)} />
            </View>
          ) : null}

          <Button
            fullWidth
            label={
              mode === 'login'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : mode === 'verify'
                    ? 'Verify email'
                    : mode === 'forgot'
                      ? 'Send reset code'
                      : 'Reset password'
            }
            onPress={() => void submit()}
            loading={busy}
            disabled={!isOnline}
          />

          {mode === 'login' ? (
            <View style={styles.linkRow}>
              <Button
                label="Forgot password?"
                variant="ghost"
                onPress={() => changeMode('forgot')}
              />
              <Button label="Have a code?" variant="ghost" onPress={() => changeMode('verify')} />
            </View>
          ) : null}
          {mode === 'verify' ? (
            <Button
              label="Resend verification code"
              variant="ghost"
              disabled={busy || !email.trim()}
              onPress={() => {
                void resendVerification({ email: email.trim() })
                  .then((result) =>
                    setVerificationHint(
                      result.debugCode
                        ? `A new code was sent. Development code: ${result.debugCode}`
                        : 'A new verification code was sent.',
                    ),
                  )
                  .catch((requestError) => setError(errorMessage(requestError)));
              }}
            />
          ) : null}

          <View style={[styles.serverToggle, { borderTopColor: colors.border }]}>
            <Button
              label={showServer ? 'Hide connection settings' : 'Connection settings'}
              variant="ghost"
              onPress={() => setShowServer((value) => !value)}
            />
            {showServer ? (
              <View style={styles.serverFields}>
                <TextField
                  label="API URL"
                  value={apiBaseUrl}
                  onChangeText={setApiBaseUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={defaultApiBaseUrl}
                />
                <TextField
                  label="Realtime URL"
                  value={realtimeBaseUrl}
                  onChangeText={setRealtimeBaseUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={defaultRealtimeBaseUrl}
                />
              </View>
            ) : null}
          </View>
        </Card>
        <Text style={[styles.footer, { color: colors.textSubtle }]}>
          {t('auth.title')} is designed for your organization, not your public social profile.
        </Text>
      </CenteredContent>
    </Page>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  centered: { gap: spacing.md },
  hero: {
    minHeight: 250,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.lg,
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  heroImage: { opacity: 0.68 },
  heroVeil: { ...StyleSheet.absoluteFillObject },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { fontSize: 20, lineHeight: 24, fontWeight: '900' },
  brandName: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '900' },
  heroTitle: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '900', maxWidth: 330 },
  heroText: { color: '#F6F1FF', fontSize: 15, lineHeight: 22, maxWidth: 350 },
  formCard: { gap: spacing.md },
  formHeading: { gap: 4 },
  formTitle: { ...typography.title, fontSize: 24, lineHeight: 30 },
  formSubtitle: { fontSize: 15, lineHeight: 22 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  backButton: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  error: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingLeft: spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -spacing.sm,
  },
  serverToggle: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  serverFields: { gap: spacing.sm },
  footer: { textAlign: 'center', fontSize: 12, lineHeight: 17, paddingHorizontal: spacing.lg },
});
