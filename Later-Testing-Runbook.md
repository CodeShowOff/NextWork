# Phase 9 Later Testing Runbook

Date created: 2026-03-17
Owner: QA + Mobile + Backend
Purpose: run the remaining manual and staged checks that are intentionally deferred until test devices and target environment are ready.

## Scope

This runbook covers three deferred validation areas:

1. Manual screen-reader pass on key mobile flows.
2. Accessibility automated test additions for critical controls.
3. Abuse and rate-limit verification using the abuse test script against a live API target.

## Exit Criteria

All of the following must be true:

- Screen-reader checks pass for Feed, Post Detail, Messages, Notifications, and Profile.
- Accessibility tests are added and passing in CI for critical controls.
- Abuse check returns expected rate-limit behavior and records at least one 429 response.
- Evidence is captured in this document under the Evidence Log section.

---

## Part A: Manual Screen-Reader Pass

### A1. Prerequisites

- Android device/emulator with TalkBack enabled and app installed.
- iOS device/simulator with VoiceOver enabled and app installed.
- Test user account with enough seed data to view feed posts, notifications, and messages.
- Latest mobile build that includes Phase 8 accessibility labels.

### A2. General Validation Rules

For each screen, validate:

- Focus order follows visual order and does not jump unexpectedly.
- Every actionable element is announced as a button, switch, or field as applicable.
- Important labels are announced clearly and are meaningful.
- No duplicate, empty, or misleading spoken labels.
- Keyboard and screen-reader navigation can complete the flow without touch exploration tricks.

### A3. Screen Checklist

#### Feed

- Open Feed tab.
- Move focus from top to bottom.
- Confirm composer input is announced with a clear label.
- Confirm Attach image and Post controls are announced as buttons.
- Confirm per-post actions Like, Comments, Share are announced and reachable.
- If post author is current user, confirm Edit and Delete are announced and reachable.

Pass condition:

- User can create and interact with a post using only screen-reader focus navigation.

#### Post Detail

- Open a post from feed into Post Detail.
- Confirm post action buttons are announced in logical order.
- Confirm comment input and Send behavior are announced properly.
- Confirm edit and delete actions for own post are announced and operable.

Pass condition:

- User can read post details and complete core post actions with screen-reader enabled.

#### Messages

- Open Messages tab and enter a conversation.
- Confirm message composer field and Send button are announced.
- Confirm message bubbles are announced with understandable sender/body context.
- Long-press a self-authored message and verify edit actions (Save, Cancel) are announced.

Pass condition:

- User can send and edit messages with screen-reader enabled.

#### Notifications

- Open Notifications tab.
- Confirm Mark all read is announced as a button.
- Confirm preference switches are announced with their labels and switch state.
- Confirm each notification item announces clear message and hint.
- Confirm muted actor chips are announced and actionable.

Pass condition:

- User can manage notifications and preferences using screen-reader navigation.

#### Profile

- Open Profile tab.
- Confirm profile action buttons are announced and reachable.
- Confirm language selection chips announce selected state.
- Confirm theme selection chips announce selected state.

Pass condition:

- User can complete profile-level settings and actions without accessibility blockers.

### A4. Defect Severity Guidance

- Critical: cannot complete a core journey because control is not reachable or unlabeled.
- Major: control is reachable but misleading/missing semantics cause high confusion.
- Minor: wording or ordering issue with workaround available.

---

## Part B: Accessibility Test Additions

### B1. Target Test Areas

Add automated tests for critical controls in mobile app:

- Feed composer and key post action buttons.
- Messages composer send action and edit action controls.
- Notifications mark-all button and preference switches.
- Profile language and theme chips selected state.

### B2. Suggested Test Strategy

- Use integration tests focused on rendered accessibility props.
- Validate at minimum:
  - accessibilityLabel values
  - accessibilityRole values
  - accessibilityState.selected for chip-style selectors

### B3. Suggested File Placement

- mobile-app/src/features/feed/FeedScreen.accessibility.test.tsx
- mobile-app/src/features/messages/ConversationDetail.accessibility.test.tsx
- mobile-app/src/features/notifications/NotificationsScreen.accessibility.test.tsx
- mobile-app/src/features/profile/ProfileViewScreen.accessibility.test.tsx

### B4. Acceptance for This Part

- New accessibility tests exist and run under mobile test command.
- Tests fail if critical labels or roles regress.
- CI pipeline includes these tests in standard mobile suite.

---

## Part C: Abuse and Rate-Limit Validation

### C1. Why This Needs Environment Configuration

The abuse script sends repeated requests to a real API endpoint. It requires a reachable target URL and optional auth.

### C2. Required Environment Variables

- ABUSE_TEST_BASE_URL: required, for example http://localhost:4000/api/v1 or staging API base.

Optional:

- ABUSE_TEST_PATH: defaults to /auth/forgot-password
- ABUSE_TEST_BODY: JSON string body, defaults to {"email":"rate-limit-check@example.com"}
- ABUSE_TEST_ATTEMPTS: defaults to 14
- ABUSE_TEST_EXPECTED_STATUS: defaults to 429
- ABUSE_TEST_BEARER_TOKEN: optional for protected endpoint testing

### C3. Recommended First Run

Use default endpoint and body first:

Windows PowerShell example:

$env:ABUSE_TEST_BASE_URL="http://localhost:4000/api/v1"
npm run test:abuse

### C4. Staging Example

$env:ABUSE_TEST_BASE_URL="https://staging-api.example.com/api/v1"
$env:ABUSE_TEST_PATH="/auth/login"
$env:ABUSE_TEST_BODY='{"email":"loadtest@example.com","password":"invalid-password"}'
npm run test:abuse

### C5. Expected Output Pattern

- Script prints status histogram summary.
- Script reports first attempt index where expected status appears.
- Successful run exits with code 0.

### C6. Failure Handling

If no expected 429 appears:

- Confirm target endpoint has active rate-limit policy.
- Confirm requests are sent from one source IP/session.
- Increase attempt count and retry.
- Check Redis and guard configuration in backend environment.

---

## Evidence Log

Use this template for signoff evidence.

### Manual Accessibility

- Device and OS:
- Build version:
- Tester:
- Result:
- Issues found:
- Links to issue tracker:

### Accessibility Automated Tests

- Branch/commit:
- Test files added:
- CI run link:
- Result summary:

### Abuse Check

- Environment URL:
- Endpoint tested:
- Attempts:
- Expected status:
- Output summary:
- Result:

---

## Final Signoff Block

- QA lead: [ ] approved
- Mobile lead: [ ] approved
- Backend lead: [ ] approved
- Release manager: [ ] approved

Status: [ ] ready for phased rollout continuation
