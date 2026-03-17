import { extractInviteToken } from './invite-linking';

describe('extractInviteToken', () => {
  it('extracts inviteToken query parameter', () => {
    expect(extractInviteToken('workplace://open?inviteToken=abc123')).toBe('abc123');
  });

  it('extracts token query parameter fallback', () => {
    expect(extractInviteToken('https://workplace.app/invite?token=xyz789')).toBe('xyz789');
  });

  it('extracts token from /invite/:token path', () => {
    expect(extractInviteToken('workplace://invite/my-token')).toBe('my-token');
  });

  it('extracts token from custom host invite URL', () => {
    expect(extractInviteToken('workplace://invite/abc123')).toBe('abc123');
  });

  it('extracts token from https path invite URL', () => {
    expect(extractInviteToken('https://workplace.app/invite/abc123')).toBe('abc123');
  });

  it('returns null for invalid URLs', () => {
    expect(extractInviteToken('not a url')).toBeNull();
  });

  it('returns null when invite token is missing', () => {
    expect(extractInviteToken('workplace://open')).toBeNull();
  });
});
