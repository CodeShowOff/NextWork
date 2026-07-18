import { extractInviteToken } from './invite-linking';

describe('extractInviteToken', () => {
  it('extracts inviteToken query parameter', () => {
    expect(extractInviteToken('nextwork://open?inviteToken=abc123')).toBe('abc123');
  });

  it('extracts token query parameter fallback', () => {
    expect(extractInviteToken('https://nextwork.app/invite?token=xyz789')).toBe('xyz789');
  });

  it('extracts token from /invite/:token path', () => {
    expect(extractInviteToken('nextwork://invite/my-token')).toBe('my-token');
  });

  it('extracts token from custom host invite URL', () => {
    expect(extractInviteToken('nextwork://invite/abc123')).toBe('abc123');
  });

  it('extracts token from https path invite URL', () => {
    expect(extractInviteToken('https://nextwork.app/invite/abc123')).toBe('abc123');
  });

  it('returns null for invalid URLs', () => {
    expect(extractInviteToken('not a url')).toBeNull();
  });

  it('returns null when invite token is missing', () => {
    expect(extractInviteToken('nextwork://open')).toBeNull();
  });
});
