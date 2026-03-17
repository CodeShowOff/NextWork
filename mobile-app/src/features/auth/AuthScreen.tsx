import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  confirmPasswordReset,
  login,
  requestPasswordReset,
  resendVerification,
  signUp,
  verifyEmail,
} from '../../shared/api/auth.api';
import { useInviteLinkStore } from '../../shared/session/invite-link.store';
import { getCurrentUser } from '../../shared/api/users.api';
import { useSessionStore } from '../../shared/session/session.store';
import { authSessionService } from '../../shared/session/auth-session.service';

type SignUpStep = 0 | 1 | 2 | 3 | 4 | 5;

const signUpStepOrder: SignUpStep[] = [0, 1, 2, 3, 4, 5];

const signUpStepLabelKeys: Record<SignUpStep, string> = {
  0: 'auth.stepLabels.email',
  1: 'auth.stepLabels.password',
  2: 'auth.stepLabels.fullName',
  3: 'auth.stepLabels.organizationName',
  4: 'auth.stepLabels.organizationSize',
  5: 'auth.stepLabels.jobTitle',
};

export function AuthScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authStep, setAuthStep] = useState<'credentials' | 'verify' | 'forgot' | 'reset'>('credentials');
  const [signUpStep, setSignUpStep] = useState<SignUpStep>(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationSize, setOrganizationSize] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [realtimeBaseUrl, setRealtimeBaseUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setSession = useSessionStore((state) => state.setSession);
  const pendingInviteToken = useInviteLinkStore((state) => state.pendingInviteToken);
  const clearPendingInviteToken = useInviteLinkStore((state) => state.clearPendingInviteToken);
  const inviteToken = pendingInviteToken.trim();
  const isInviteSignup = mode === 'signup' && inviteToken.length > 0;
  const activeSignUpSteps: SignUpStep[] = isInviteSignup ? [0, 1, 2] : signUpStepOrder;
  const maxSignUpStep = activeSignUpSteps[activeSignUpSteps.length - 1];

  useEffect(() => {
    if (mode !== 'signup') {
      return;
    }

    if (!activeSignUpSteps.includes(signUpStep)) {
      setSignUpStep(activeSignUpSteps[0]);
    }
  }, [activeSignUpSteps, mode, signUpStep]);

  const isCurrentSignUpStepValid = () => {
    switch (signUpStep) {
      case 0:
        return Boolean(email.trim());
      case 1:
        return Boolean(password.trim());
      case 2:
        return Boolean(fullName.trim());
      case 3:
        return Boolean(organizationName.trim());
      case 4:
        return Boolean(organizationSize.trim());
      case 5:
        return Boolean(jobTitle.trim());
      default:
        return false;
    }
  };

  const canSubmitSignup =
    Boolean(email.trim()) &&
    Boolean(password.trim()) &&
    Boolean(fullName.trim()) &&
    (isInviteSignup
      ? true
      : Boolean(organizationName.trim()) &&
        Boolean(organizationSize.trim()) &&
        Boolean(jobTitle.trim()));

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setAuthStep('credentials');
    setAuthHint(null);
    if (nextMode === 'signup') {
      setSignUpStep(0);
    }
  };

  const parseApiErrorMessage = (error: unknown): string => {
    const fallback = (error as Error).message || t('auth.alerts.authFailedTitle');

    try {
      const parsed = JSON.parse(fallback) as {
        error?: {
          message?: string | string[];
        };
      };

      const message = parsed.error?.message;
      if (Array.isArray(message)) {
        return message.join(', ');
      }
      if (typeof message === 'string') {
        return message;
      }
    } catch {
      // Keep fallback.
    }

    return fallback;
  };

  const submitVerification = async () => {
    if (!email.trim() || !verificationToken.trim()) {
      Alert.alert(t('auth.alerts.missingFieldsTitle'), t('auth.alerts.missingVerificationFieldsBody'));
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyEmail({
        email: email.trim(),
        token: verificationToken.trim(),
      });

      setAuthHint(t('auth.alerts.verifySuccessBody'));
      setAuthStep('credentials');
      setMode('login');
      setVerificationToken('');
      Alert.alert(t('auth.alerts.verifySuccessTitle'), t('auth.alerts.verifySuccessBody'));
    } catch (error) {
      Alert.alert(t('auth.alerts.verifyFailedTitle'), parseApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.alerts.missingFieldsTitle'), t('auth.alerts.missingEmailFieldBody'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestPasswordReset({
        email: email.trim(),
      });

      const expiryText = result.expiresAt
        ? t('auth.alerts.resetRequestedWithExpiryBody', {
            expiresAt: new Date(result.expiresAt).toLocaleString(),
          })
        : t('auth.alerts.resetRequestedBody');
      const debugText = result.debugCode
        ? `\n${t('auth.alerts.debugCodeLabel')}: ${result.debugCode}`
        : '';

      setAuthHint(`${expiryText}${debugText}`);
      setAuthStep('reset');
      Alert.alert(t('auth.alerts.resetRequestedTitle'), `${expiryText}${debugText}`);
    } catch (error) {
      Alert.alert(t('auth.alerts.resetRequestFailedTitle'), parseApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitResetPassword = async () => {
    if (!email.trim() || !resetToken.trim() || !newPassword.trim()) {
      Alert.alert(t('auth.alerts.missingFieldsTitle'), t('auth.alerts.missingResetFieldsBody'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert(t('auth.alerts.resetMismatchTitle'), t('auth.alerts.resetMismatchBody'));
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset({
        email: email.trim(),
        token: resetToken.trim(),
        newPassword: newPassword.trim(),
      });

      setPassword(newPassword.trim());
      setResetToken('');
      setNewPassword('');
      setConfirmNewPassword('');
      setAuthHint(t('auth.alerts.resetSuccessBody'));
      setAuthStep('credentials');
      setMode('login');
      Alert.alert(t('auth.alerts.resetSuccessTitle'), t('auth.alerts.resetSuccessBody'));
    } catch (error) {
      Alert.alert(t('auth.alerts.resetFailedTitle'), parseApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('auth.alerts.missingFieldsTitle'), t('auth.alerts.missingLoginFieldsBody'));
      return;
    }

    if (mode === 'signup' && !canSubmitSignup) {
      Alert.alert(t('auth.alerts.missingFieldsTitle'), t('auth.alerts.missingSignupFieldsBody'));
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedApiBaseUrl = apiBaseUrl.trim();
      const normalizedRealtimeBaseUrl = realtimeBaseUrl.trim();

      if (mode === 'signup') {
        const signupResult = await signUp({
          email: email.trim(),
          password: password.trim(),
          displayName: fullName.trim(),
          fullName: fullName.trim(),
          organizationName: isInviteSignup ? '' : organizationName.trim(),
          organizationSize: isInviteSignup ? '' : organizationSize.trim(),
          jobTitle: isInviteSignup ? '' : jobTitle.trim(),
          ...(isInviteSignup ? { inviteToken } : {}),
        });

        const expiryText = t('auth.alerts.verificationRequiredBody', {
          expiresAt: new Date(signupResult.expiresAt).toLocaleString(),
        });
        const debugText = signupResult.debugCode
          ? `\n${t('auth.alerts.debugCodeLabel')}: ${signupResult.debugCode}`
          : '';

        setAuthHint(`${expiryText}${debugText}`);
        setAuthStep('verify');
        setMode('login');
        setVerificationToken('');
        if (isInviteSignup) {
          clearPendingInviteToken();
        }
        Alert.alert(t('auth.alerts.verificationRequiredTitle'), `${expiryText}${debugText}`);
        return;
      }

      const tokens = await login({
        email: email.trim(),
        password: password.trim(),
      });

      const previous = useSessionStore.getState();
      setSession({
        userId: 'pending',
        accessToken: tokens.accessToken,
        apiBaseUrl: normalizedApiBaseUrl || previous.apiBaseUrl,
        realtimeBaseUrl: normalizedRealtimeBaseUrl || previous.realtimeBaseUrl,
      });

      const me = await getCurrentUser();
      await authSessionService.establishSession({
        userId: me.id,
        tokens,
        apiBaseUrl: normalizedApiBaseUrl || previous.apiBaseUrl,
        realtimeBaseUrl: normalizedRealtimeBaseUrl || previous.realtimeBaseUrl,
      });
    } catch (error) {
      await authSessionService.clearSession();
      const message = parseApiErrorMessage(error);
      if (message.toLowerCase().includes('email not verified')) {
        setAuthStep('verify');
        setAuthHint(t('auth.alerts.verifyBeforeLoginHint'));
      }

      Alert.alert(t('auth.alerts.authFailedTitle'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t('auth.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeButton, mode === 'login' ? styles.modeActive : null]}
              onPress={() => switchMode('login')}
            >
              <Text style={styles.modeText}>{t('auth.modeLogin')}</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, mode === 'signup' ? styles.modeActive : null]}
              onPress={() => switchMode('signup')}
            >
              <Text style={styles.modeText}>{t('auth.modeSignup')}</Text>
            </Pressable>
          </View>

          {authHint ? <Text style={styles.hintText}>{authHint}</Text> : null}

          {authStep === 'verify' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.placeholders.email')}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                value={verificationToken}
                onChangeText={setVerificationToken}
                placeholder={t('auth.placeholders.verificationToken')}
                style={styles.input}
                autoCapitalize="none"
              />
              <View style={styles.wizardActionsRow}>
                <Pressable
                  style={styles.secondaryWizardButton}
                  onPress={() => setAuthStep('credentials')}
                >
                  <Text style={styles.secondaryWizardButtonText}>{t('common.actions.back')}</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryWizardButton}
                  onPress={async () => {
                    setIsSubmitting(true);
                    try {
                      const result = await resendVerification({ email: email.trim() });
                      const expiryText = result.expiresAt
                        ? t('auth.alerts.verificationRequiredBody', {
                            expiresAt: new Date(result.expiresAt).toLocaleString(),
                          })
                        : t('auth.alerts.resendDoneBody');
                      const debugText = result.debugCode
                        ? `\n${t('auth.alerts.debugCodeLabel')}: ${result.debugCode}`
                        : '';
                      setAuthHint(`${expiryText}${debugText}`);
                      Alert.alert(t('auth.alerts.resendDoneTitle'), `${expiryText}${debugText}`);
                    } catch (error) {
                      Alert.alert(t('auth.alerts.resendFailedTitle'), parseApiErrorMessage(error));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  <Text style={styles.secondaryWizardButtonText}>{t('auth.buttons.resendCode')}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.submitButton} onPress={submitVerification} disabled={isSubmitting}>
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? t('auth.buttons.pleaseWait') : t('auth.buttons.verifyEmail')}
                </Text>
              </Pressable>
            </>
          ) : null}

          {authStep === 'forgot' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.placeholders.email')}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <View style={styles.wizardActionsRow}>
                <Pressable style={styles.secondaryWizardButton} onPress={() => setAuthStep('credentials')}>
                  <Text style={styles.secondaryWizardButtonText}>{t('common.actions.back')}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.submitButton} onPress={submitForgotPassword} disabled={isSubmitting}>
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? t('auth.buttons.pleaseWait') : t('auth.buttons.sendResetCode')}
                </Text>
              </Pressable>
            </>
          ) : null}

          {authStep === 'reset' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.placeholders.email')}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                value={resetToken}
                onChangeText={setResetToken}
                placeholder={t('auth.placeholders.resetToken')}
                style={styles.input}
                autoCapitalize="none"
              />
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t('auth.placeholders.newPassword')}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
              />
              <TextInput
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder={t('auth.placeholders.confirmNewPassword')}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
              />
              <View style={styles.wizardActionsRow}>
                <Pressable style={styles.secondaryWizardButton} onPress={() => setAuthStep('forgot')}>
                  <Text style={styles.secondaryWizardButtonText}>{t('common.actions.back')}</Text>
                </Pressable>
              </View>
              <Pressable style={styles.submitButton} onPress={submitResetPassword} disabled={isSubmitting}>
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? t('auth.buttons.pleaseWait') : t('auth.buttons.resetPassword')}
                </Text>
              </Pressable>
            </>
          ) : null}

          {mode === 'login' && authStep === 'credentials' ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.placeholders.email')}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.placeholders.password')}
                style={styles.input}
                secureTextEntry
                autoCapitalize="none"
              />
              <Pressable onPress={() => setAuthStep('forgot')}>
                <Text style={styles.linkText}>{t('auth.buttons.forgotPassword')}</Text>
              </Pressable>
              <Pressable onPress={() => setAuthStep('verify')}>
                <Text style={styles.linkText}>{t('auth.buttons.verifyInstead')}</Text>
              </Pressable>
            </>
          ) : (
            mode === 'signup' && authStep === 'credentials' ? (
              <>
              {isInviteSignup ? <Text style={styles.inviteHintText}>{t('auth.inviteSignupHint')}</Text> : null}
              <View style={styles.stepHeaderRow}>
                <Text style={styles.stepHeaderTitle}>
                  {t('auth.stepTitle', {
                    current: activeSignUpSteps.indexOf(signUpStep) + 1,
                    total: activeSignUpSteps.length,
                  })}
                </Text>
                <Text style={styles.stepHeaderLabel}>{t(signUpStepLabelKeys[signUpStep])}</Text>
              </View>

              {signUpStep === 0 ? (
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.placeholders.email')}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              ) : null}

              {signUpStep === 1 ? (
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.placeholders.password')}
                  style={styles.input}
                  secureTextEntry
                  autoCapitalize="none"
                />
              ) : null}

              {signUpStep === 2 ? (
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t('auth.placeholders.fullName')}
                  style={styles.input}
                  autoCapitalize="words"
                />
              ) : null}

              {signUpStep === 3 ? (
                <TextInput
                  value={organizationName}
                  onChangeText={setOrganizationName}
                  placeholder={t('auth.placeholders.organizationName')}
                  style={styles.input}
                  autoCapitalize="words"
                />
              ) : null}

              {signUpStep === 4 ? (
                <TextInput
                  value={organizationSize}
                  onChangeText={setOrganizationSize}
                  placeholder={t('auth.placeholders.organizationSize')}
                  style={styles.input}
                />
              ) : null}

              {signUpStep === 5 ? (
                <TextInput
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder={t('auth.placeholders.jobTitle')}
                  style={styles.input}
                  autoCapitalize="words"
                />
              ) : null}

              <View style={styles.wizardActionsRow}>
                <Pressable
                  style={[styles.secondaryWizardButton, signUpStep === 0 ? styles.disabledButton : null]}
                  onPress={() => {
                    if (signUpStep === 0) {
                      return;
                    }

                    const previousStep = activeSignUpSteps[activeSignUpSteps.indexOf(signUpStep) - 1];
                    setSignUpStep(previousStep);
                  }}
                  disabled={signUpStep === 0}
                >
                  <Text style={styles.secondaryWizardButtonText}>{t('common.actions.back')}</Text>
                </Pressable>

                {signUpStep < maxSignUpStep ? (
                  <Pressable
                    style={[styles.secondaryWizardButton, !isCurrentSignUpStepValid() ? styles.disabledButton : null]}
                    onPress={() => {
                      if (!isCurrentSignUpStepValid()) {
                        Alert.alert(
                          t('auth.alerts.missingFieldsTitle'),
                          t('auth.alerts.missingStepFieldBody', {
                            field: t(signUpStepLabelKeys[signUpStep]).toLowerCase(),
                          }),
                        );
                        return;
                      }

                      const nextStep = activeSignUpSteps[activeSignUpSteps.indexOf(signUpStep) + 1];
                      setSignUpStep(nextStep);
                    }}
                    disabled={!isCurrentSignUpStepValid()}
                  >
                    <Text style={styles.secondaryWizardButtonText}>{t('common.actions.next')}</Text>
                  </Pressable>
                ) : null}
              </View>
              </>
            ) : null
          )}

          <TextInput
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            placeholder={t('auth.placeholders.apiUrl')}
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={realtimeBaseUrl}
            onChangeText={setRealtimeBaseUrl}
            placeholder={t('auth.placeholders.realtimeUrl')}
            style={styles.input}
            autoCapitalize="none"
          />

          <Pressable
            style={[
              styles.submitButton,
              mode === 'signup' && !canSubmitSignup ? styles.disabledButton : null,
            ]}
            onPress={submit}
            disabled={
              isSubmitting ||
              authStep !== 'credentials' ||
              (mode === 'signup' && !canSubmitSignup)
            }
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? t('auth.buttons.pleaseWait') : t('auth.buttons.continue')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    color: '#475569',
    lineHeight: 20,
  },
  hintText: {
    color: '#0F766E',
    fontSize: 12,
    backgroundColor: '#ECFEFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    borderRadius: 10,
    padding: 8,
  },
  inviteHintText: {
    color: '#1D4ED8',
    fontSize: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 8,
  },
  linkText: {
    color: '#0369A1',
    fontWeight: '600',
    fontSize: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  modeActive: {
    backgroundColor: '#0B6E4F',
    borderColor: '#0B6E4F',
  },
  modeText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  stepHeaderTitle: {
    color: '#0F172A',
    fontWeight: '700',
  },
  stepHeaderLabel: {
    color: '#475569',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wizardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  secondaryWizardButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0B6E4F',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryWizardButtonText: {
    color: '#0B6E4F',
    fontWeight: '700',
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#0B6E4F',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
