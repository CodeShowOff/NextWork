# Mobile E2E Flows (Maestro)

This folder contains key release smoke flows for production readiness.

## Flows

- maestro/feed-message-flow.yaml: feed create + messaging + notifications navigation
- maestro/invite-group-flow.yaml: groups/search baseline flow
- maestro/auth-recovery-flow.yaml: forgot/reset/verify journey entrypoints for auth recovery
- maestro/post-lifecycle-flow.yaml: post create/edit/delete lifecycle smoke flow
- maestro/messaging-offline-reconnect-flow.yaml: verifies offline message persistence and delivery after reconnect (manual dual-user setup)
- maestro/messaging-attachments-flow.yaml: verifies attachment pending/uploading/failed/retry and receive rendering flow (manual media picker + dual-user setup)
- maestro/messaging-reactions-flow.yaml: verifies add/remove/change reactions and realtime synchronization across participants
- maestro/notifications-cross-device-read-flow.yaml: verifies read-state/badge synchronization across devices (manual dual-device setup)

## Run Locally

1. Install Maestro CLI.
2. Start emulator or attach physical device.
3. Build and install the app.
4. Run:

```bash
maestro test mobile-app/e2e/maestro/feed-message-flow.yaml
maestro test mobile-app/e2e/maestro/invite-group-flow.yaml
maestro test mobile-app/e2e/maestro/auth-recovery-flow.yaml
maestro test mobile-app/e2e/maestro/post-lifecycle-flow.yaml
maestro test mobile-app/e2e/maestro/messaging-offline-reconnect-flow.yaml
maestro test mobile-app/e2e/maestro/messaging-attachments-flow.yaml
maestro test mobile-app/e2e/maestro/messaging-reactions-flow.yaml
maestro test mobile-app/e2e/maestro/notifications-cross-device-read-flow.yaml
```

These flows are designed as release smoke checks and should pass in internal and beta rollout stages.
