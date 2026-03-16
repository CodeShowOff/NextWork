import React, { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getProfile, updateMyProfile } from '../../shared/api/profiles.api';
import { getCurrentUser } from '../../shared/api/users.api';
import { useSessionStore } from '../../shared/session/session.store';

export function ProfileScreen() {
  const queryClient = useQueryClient();
  const clearSession = useSessionStore((state) => state.clearSession);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const meQuery = useQuery({
    queryKey: ['users', 'me'],
    queryFn: getCurrentUser,
  });

  const profileQuery = useQuery({
    queryKey: ['profiles', meQuery.data?.id],
    queryFn: () => getProfile(meQuery.data?.id as string),
    enabled: Boolean(meQuery.data?.id),
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setDisplayName(profileQuery.data.displayName ?? '');
    setBio(profileQuery.data.bio ?? '');
    setAvatarUrl(profileQuery.data.avatarUrl ?? '');
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles', meQuery.data?.id] });
      Alert.alert('Saved', 'Your profile was updated.');
    },
    onError: (error) => Alert.alert('Could not update profile', (error as Error).message),
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Email: {meQuery.data?.email ?? 'Loading...'}</Text>

        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Display name"
          style={styles.input}
        />
        <TextInput value={bio} onChangeText={setBio} placeholder="Bio" style={styles.input} multiline />
        <TextInput
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder="Avatar URL"
          style={styles.input}
          autoCapitalize="none"
        />

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            updateMutation.mutate({
              displayName: displayName.trim() || undefined,
              bio: bio.trim() || undefined,
              avatarUrl: avatarUrl.trim() || undefined,
            });
          }}
        >
          <Text style={styles.primaryButtonText}>Save profile</Text>
        </Pressable>

        <Pressable
          style={styles.logoutButton}
          onPress={() => {
            clearSession();
          }}
        >
          <Text style={styles.logoutButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 6,
    color: '#475569',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#0B6E4F',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B91C1C',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
});
