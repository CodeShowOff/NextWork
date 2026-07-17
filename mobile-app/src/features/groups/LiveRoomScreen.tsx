import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { AudioSession, LiveKitRoom, useLocalParticipant, useParticipants, useTracks, VideoTrack } from '@livekit/react-native';
import { Track } from 'livekit-client';

import { endGroupLiveSession } from '../../shared/api/group-collaboration.api';
import { AppButton, AppScreen, AppState } from '../../shared/ui/AppUI';
import { spacing, useAppColors } from '../../shared/ui/design-tokens';
import { GroupsStackParamList } from './GroupsStack';

type Props = NativeStackScreenProps<GroupsStackParamList, 'LiveRoom'>;

function RoomStage() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera]);

  return (
    <View style={styles.stage}>
      <Text style={[styles.participants, { color: colors.textMuted }]}>
        {t('ui.groups.participants', { count: participants.length })}
      </Text>
      {tracks.length ? (
        <View style={styles.grid}>
          {tracks.map((track) => <VideoTrack key={`${track.participant.identity}-${track.source}`} trackRef={track} style={styles.video} />)}
        </View>
      ) : (
        <View style={[styles.emptyStage, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={{ color: colors.textMuted }}>{t('ui.groups.waitingForVideo')}</Text>
        </View>
      )}
    </View>
  );
}

function RoomDeviceControls() {
  const { t } = useTranslation();
  const colors = useAppColors();
  const [updating, setUpdating] = useState<'microphone' | 'camera' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isCameraEnabled, isMicrophoneEnabled, localParticipant } = useLocalParticipant();

  const toggle = async (kind: 'microphone' | 'camera') => {
    setUpdating(kind);
    setError(null);
    try {
      if (kind === 'microphone') {
        await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      } else {
        await localParticipant.setCameraEnabled(!isCameraEnabled);
      }
    } catch (toggleError) {
      setError((toggleError as Error).message);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <View style={styles.deviceControls}>
      <AppButton
        label={isMicrophoneEnabled ? t('ui.groups.muteMicrophone') : t('ui.groups.unmuteMicrophone')}
        variant="secondary"
        loading={updating === 'microphone'}
        onPress={() => void toggle('microphone')}
      />
      <AppButton
        label={isCameraEnabled ? t('ui.groups.turnCameraOff') : t('ui.groups.turnCameraOn')}
        variant="secondary"
        loading={updating === 'camera'}
        onPress={() => void toggle('camera')}
      />
      {error ? <Text style={[styles.deviceError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function LiveRoomScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    void AudioSession.startAudioSession();
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, []);

  const leave = async () => {
    if (!route.params.host) {
      navigation.goBack();
      return;
    }
    setEnding(true);
    try {
      await endGroupLiveSession(route.params.groupId);
      navigation.goBack();
    } catch (requestError) {
      Alert.alert(t('ui.states.errorTitle'), (requestError as Error).message);
    } finally {
      setEnding(false);
    }
  };

  if (error) {
    return <AppScreen><AppState kind="error" title={t('ui.states.errorTitle')} body={error} action={{ label: t('ui.actions.back'), onPress: () => navigation.goBack() }} /></AppScreen>;
  }

  return (
    <AppScreen contentStyle={styles.screen}>
      <LiveKitRoom
        serverUrl={route.params.serverUrl}
        token={route.params.token}
        connect
        audio
        video
        onConnected={() => setConnected(true)}
        onError={(liveError) => setError(liveError.message)}
      >
        <RoomStage />
        <RoomDeviceControls />
      </LiveKitRoom>
      {!connected ? <AppState kind="loading" title={t('ui.groups.connectingLive')} /> : null}
      <View style={styles.controls}>
        <AppButton label={route.params.host ? t('ui.groups.endLive') : t('ui.groups.leaveLive')} variant="danger" loading={ending} onPress={() => void leave()} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.md, gap: spacing.md },
  stage: { flex: 1, minHeight: 220, gap: spacing.sm },
  participants: { fontSize: 14, fontWeight: '700' },
  grid: { flex: 1, gap: spacing.sm },
  video: { flex: 1, minHeight: 220, borderRadius: 16, overflow: 'hidden' },
  emptyStage: { flex: 1, minHeight: 220, alignItems: 'center', justifyContent: 'center', borderRadius: 16, padding: spacing.md },
  deviceControls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  deviceError: { fontSize: 12, width: '100%' },
  controls: { paddingBottom: spacing.xs },
});
