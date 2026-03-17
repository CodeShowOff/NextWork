#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const requiredFlows = [
  'mobile-app/e2e/maestro/feed-message-flow.yaml',
  'mobile-app/e2e/maestro/invite-group-flow.yaml',
  'mobile-app/e2e/maestro/auth-recovery-flow.yaml',
  'mobile-app/e2e/maestro/auth-session-refresh-race-flow.yaml',
  'mobile-app/e2e/maestro/post-lifecycle-flow.yaml',
  'mobile-app/e2e/maestro/poll-vote-regression-flow.yaml',
  'mobile-app/e2e/maestro/messaging-offline-reconnect-flow.yaml',
  'mobile-app/e2e/maestro/notifications-cross-device-read-flow.yaml',
  'mobile-app/e2e/maestro/flashlist-pagination-flow.yaml',
];

const missing = requiredFlows.filter((flow) => !fs.existsSync(path.resolve(process.cwd(), flow)));
if (missing.length > 0) {
  console.error('Missing required mobile E2E flows:\n- ' + missing.join('\n- '));
  process.exit(1);
}

console.log('Mobile E2E flow inventory check passed.');
