# Phase 2 Token Leakage Checklist

Date: 2026-03-17
Owner: Mobile
Status: Pending execution on devices

## Scope

This checklist validates that access and refresh tokens are protected during storage, startup hydration, refresh, and logout flows.

## Static Checks

- [x] Access/refresh tokens are persisted only through secure storage repository.
- [x] Zustand session store holds access token in memory only and does not persist refresh token.
- [x] Logout path wipes secure storage and in-memory session state.
- [x] Unauthorized request flow attempts refresh once and clears session on refresh failure.
- [x] No token values are logged by session lifecycle code paths.

## Dynamic Checks (Android)

- [ ] Login stores tokens and app opens authenticated tabs.
- [ ] App cold restart restores authenticated session.
- [ ] Force access token expiry and verify refresh flow restores API access.
- [ ] Corrupt refresh token and verify app clears session and returns to auth screen.
- [ ] Logout clears session and cold restart remains signed out.
- [ ] Capture device logs and confirm no token string appears.

## Dynamic Checks (iOS)

- [ ] Login stores tokens and app opens authenticated tabs.
- [ ] App cold restart restores authenticated session.
- [ ] Force access token expiry and verify refresh flow restores API access.
- [ ] Corrupt refresh token and verify app clears session and returns to auth screen.
- [ ] Logout clears session and cold restart remains signed out.
- [ ] Capture device logs and confirm no token string appears.

## Evidence

- Android run notes:
- iOS run notes:
- Issues found:
- Follow-up actions:
