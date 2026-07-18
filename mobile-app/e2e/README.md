# Mobile E2E Flows (Maestro)

This folder contains key release smoke flows for the rebuilt five-destination mobile shell. The flows use stable test IDs for the adaptive navigation bar and critical composers; text selectors remain only for seeded backend content.

## Flows

- maestro/four-tab-navigation-flow.yaml: smoke test for all five destinations and search navigation (the historical filename is retained for CI compatibility)
- maestro/auth-recovery-flow.yaml: sign-in, recovery, and verification entrypoints
- maestro/auth-session-refresh-race-flow.yaml: sign-out/sign-in and alert-route refresh regression
- maestro/feed-message-flow.yaml: feed creation plus Chats and Notifications navigation
- maestro/post-lifecycle-flow.yaml: post create, edit, confirmation, and deletion
- maestro/poll-vote-regression-flow.yaml: composer poll and vote regression
- maestro/group-collaboration-flow.yaml: group files, albums, events, and live room entry
- maestro/invite-group-flow.yaml: group member invitation journey
- maestro/messaging-offline-reconnect-flow.yaml: offline/reconnect delivery check (manual dual-user setup)
- maestro/messaging-attachments-flow.yaml: attachment lifecycle and receiver rendering (manual picker/dual-user setup)
- maestro/messaging-reactions-flow.yaml: reaction synchronization across participants
- maestro/notifications-cross-device-read-flow.yaml: cross-device read state and badge synchronization

## Run Locally

1. Install Maestro CLI.
2. Start emulator or attach physical device.
3. Build and install the app.
4. Run:

```bash
maestro test mobile-app/e2e/maestro/feed-message-flow.yaml
maestro test mobile-app/e2e/maestro/four-tab-navigation-flow.yaml
maestro test mobile-app/e2e/maestro/invite-group-flow.yaml
maestro test mobile-app/e2e/maestro/auth-recovery-flow.yaml
maestro test mobile-app/e2e/maestro/auth-session-refresh-race-flow.yaml
maestro test mobile-app/e2e/maestro/post-lifecycle-flow.yaml
maestro test mobile-app/e2e/maestro/poll-vote-regression-flow.yaml
maestro test mobile-app/e2e/maestro/group-collaboration-flow.yaml
maestro test mobile-app/e2e/maestro/messaging-offline-reconnect-flow.yaml
maestro test mobile-app/e2e/maestro/messaging-attachments-flow.yaml
maestro test mobile-app/e2e/maestro/messaging-reactions-flow.yaml
maestro test mobile-app/e2e/maestro/notifications-cross-device-read-flow.yaml
```

These flows are designed as release smoke checks and should pass in internal and beta rollout stages.
