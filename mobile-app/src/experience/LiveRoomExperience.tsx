import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from '@livekit/react-native';
import { Track } from 'livekit-client';

import { endGroupLiveSession } from '../shared/api/group-collaboration.api';
import { radius, spacing, useAppColors } from '../shared/ui/design-tokens';
import { Button, EmptyState, ErrorState, IconButton, Skeleton } from '../presentation/components';
import { Page } from '../presentation/layout';
import { useToast } from '../presentation/feedback';
import { RootStackParamList } from './navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveRoom'>;

function LiveStage() {
  const colors = useAppColors();
  const participants = useParticipants();
  const tracks = useTracks([Track.Source.Camera]);
  return (
    <View style={styles.stage}>
      <View style={styles.stageTop}>
        <View style={[styles.livePill, { backgroundColor: colors.danger }]}>
          <Text style={styles.livePillText}>LIVE</Text>
        </View>
        <Text style={{ color: colors.textMuted }}>
          {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
        </Text>
      </View>
      {tracks.length ? (
        <View style={styles.videoGrid}>
          {tracks.map((track) => (
            <VideoTrack
              key={`${track.participant.identity}-${track.source}`}
              trackRef={track}
              style={styles.video}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.emptyVideo, { backgroundColor: colors.surfaceMuted }]}>
          <EmptyState
            title="Waiting for video"
            body="Turn on your camera or wait for a participant to share theirs."
            icon="videocam-off"
          />
        </View>
      )}
    </View>
  );
}

function LiveControls() {
  const colors = useAppColors();
  const { showToast } = useToast();
  const { isCameraEnabled, isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const [changing, setChanging] = useState<'camera' | 'microphone' | null>(null);
  const toggle = async (target: 'camera' | 'microphone') => {
    setChanging(target);
    try {
      if (target === 'camera') await localParticipant.setCameraEnabled(!isCameraEnabled);
      else await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (error) {
      showToast({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Could not update device.',
      });
    } finally {
      setChanging(null);
    }
  };
  return (
    <View style={[styles.liveControls, { backgroundColor: colors.surface }]}>
      <Button
        label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
        icon={isMicrophoneEnabled ? 'mic' : 'mic-off'}
        variant="secondary"
        onPress={() => void toggle('microphone')}
        loading={changing === 'microphone'}
      />
      <Button
        label={isCameraEnabled ? 'Camera off' : 'Camera on'}
        icon={isCameraEnabled ? 'videocam' : 'videocam-off'}
        variant="secondary"
        onPress={() => void toggle('camera')}
        loading={changing === 'camera'}
      />
    </View>
  );
}

export function LiveRoomExperience({ route, navigation }: Props) {
  const colors = useAppColors();
  const { showToast } = useToast();
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
    } catch (leaveError) {
      showToast({
        tone: 'error',
        message: leaveError instanceof Error ? leaveError.message : 'Could not end live room.',
      });
    } finally {
      setEnding(false);
    }
  };
  if (error)
    return (
      <Page>
        <ErrorState
          title="Couldn’t join the live room"
          body={error}
          onRetry={() => navigation.goBack()}
        />
      </Page>
    );
  return (
    <Page edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
      <View
        style={[
          styles.roomHeader,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <IconButton icon="close" label="Leave live room" onPress={() => void leave()} />
        <Text accessibilityRole="header" style={[styles.roomTitle, { color: colors.text }]}>
          Live room
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <LiveKitRoom
        serverUrl={route.params.serverUrl}
        token={route.params.token}
        connect
        audio
        video
        onConnected={() => setConnected(true)}
        onError={(liveError) => setError(liveError.message)}
      >
        <LiveStage />
        <LiveControls />
      </LiveKitRoom>
      {!connected ? (
        <View style={styles.connecting}>
          <Skeleton width={180} />
          <Text style={{ color: colors.textMuted }}>Connecting to live room…</Text>
        </View>
      ) : null}
      <View style={[styles.leaveArea, { borderTopColor: colors.border }]}>
        <Button
          label={route.params.host ? 'End room for everyone' : 'Leave room'}
          variant="danger"
          icon="call-end"
          fullWidth
          onPress={() => void leave()}
          loading={ending}
        />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  roomHeader: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    flexDirection: 'row',
  },
  roomTitle: { flex: 1, textAlign: 'center', fontSize: 18, lineHeight: 24, fontWeight: '900' },
  stage: { flex: 1, minHeight: 280, padding: spacing.md, gap: spacing.sm },
  stageTop: {
    minHeight: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePill: {
    minHeight: 24,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    justifyContent: 'center',
  },
  livePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  videoGrid: { flex: 1, gap: spacing.sm },
  video: { flex: 1, minHeight: 240, borderRadius: radius.lg, overflow: 'hidden' },
  emptyVideo: { flex: 1, borderRadius: radius.lg, overflow: 'hidden' },
  liveControls: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  connecting: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 100,
    alignItems: 'center',
    gap: spacing.xs,
  },
  leaveArea: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md },
});
