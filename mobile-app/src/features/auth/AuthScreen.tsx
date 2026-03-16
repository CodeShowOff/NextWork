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

import { login, signUp } from '../../shared/api/auth.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { useSessionStore } from '../../shared/session/session.store';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [realtimeBaseUrl, setRealtimeBaseUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setSession = useSessionStore((state) => state.setSession);

  const submit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Email and password are required.');
      return;
    }

    if (mode === 'signup' && !displayName.trim()) {
      Alert.alert('Missing fields', 'Display name is required for sign up.');
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
              displayName: displayName.trim(),
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
      Alert.alert('Authentication failed', (error as Error).message);
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
          <Text style={styles.title}>Workplace</Text>
          <Text style={styles.subtitle}>Sign in to access feed, groups, messages, and profile.</Text>

          <View style={styles.modeRow}>
            <Pressable
              style={[styles.modeButton, mode === 'login' ? styles.modeActive : null]}
              onPress={() => setMode('login')}
            >
              <Text style={styles.modeText}>Login</Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, mode === 'signup' ? styles.modeActive : null]}
              onPress={() => setMode('signup')}
            >
              <Text style={styles.modeText}>Sign Up</Text>
            </Pressable>
          </View>

          {mode === 'signup' ? (
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display name"
              style={styles.input}
              autoCapitalize="words"
            />
          ) : null}

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextInput
            value={apiBaseUrl}
            onChangeText={setApiBaseUrl}
            placeholder="API URL (optional)"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={realtimeBaseUrl}
            onChangeText={setRealtimeBaseUrl}
            placeholder="Realtime URL (optional)"
            style={styles.input}
            autoCapitalize="none"
          />

          <Pressable style={styles.submitButton} onPress={submit} disabled={isSubmitting}>
            <Text style={styles.submitButtonText}>{isSubmitting ? 'Please wait...' : 'Continue'}</Text>
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
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submitButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#0B6E4F',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
