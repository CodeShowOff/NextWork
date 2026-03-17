import React, { useState } from 'react';
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

import { login, signUp } from '../../shared/api/auth.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { useSessionStore } from '../../shared/session/session.store';

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
  const [signUpStep, setSignUpStep] = useState<SignUpStep>(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [organizationSize, setOrganizationSize] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [realtimeBaseUrl, setRealtimeBaseUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setSession = useSessionStore((state) => state.setSession);

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
    Boolean(organizationName.trim()) &&
    Boolean(organizationSize.trim()) &&
    Boolean(jobTitle.trim());

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    if (nextMode === 'signup') {
      setSignUpStep(0);
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

      const tokens =
        mode === 'signup'
          ? await signUp({
              email: email.trim(),
              password: password.trim(),
              displayName: fullName.trim(),
              fullName: fullName.trim(),
              organizationName: organizationName.trim(),
              organizationSize: organizationSize.trim(),
              jobTitle: jobTitle.trim(),
            })
          : await login({
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
      setSession({
        userId: me.id,
        accessToken: tokens.accessToken,
        apiBaseUrl: normalizedApiBaseUrl || previous.apiBaseUrl,
        realtimeBaseUrl: normalizedRealtimeBaseUrl || previous.realtimeBaseUrl,
      });
    } catch (error) {
      useSessionStore.getState().clearSession();
      Alert.alert(t('auth.alerts.authFailedTitle'), (error as Error).message);
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

          {mode === 'login' ? (
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
            </>
          ) : (
            <>
              <View style={styles.stepHeaderRow}>
                <Text style={styles.stepHeaderTitle}>
                  {t('auth.stepTitle', { current: signUpStep + 1, total: 6 })}
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

                    const previousStep = signUpStepOrder[signUpStepOrder.indexOf(signUpStep) - 1];
                    setSignUpStep(previousStep);
                  }}
                  disabled={signUpStep === 0}
                >
                  <Text style={styles.secondaryWizardButtonText}>{t('common.actions.back')}</Text>
                </Pressable>

                {signUpStep < 5 ? (
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

                      const nextStep = signUpStepOrder[signUpStepOrder.indexOf(signUpStep) + 1];
                      setSignUpStep(nextStep);
                    }}
                    disabled={!isCurrentSignUpStepValid()}
                  >
                    <Text style={styles.secondaryWizardButtonText}>{t('common.actions.next')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
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
            disabled={isSubmitting || (mode === 'signup' && !canSubmitSignup)}
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
