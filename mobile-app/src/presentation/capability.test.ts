import { capabilityCopy } from './capability';

describe('capability states', () => {
  it('keeps preview destinations visible without claiming unsupported persistence', () => {
    expect(capabilityCopy('preview')).toEqual({
      label: 'Preview',
      interactive: true,
      tone: 'preview',
    });
    expect(capabilityCopy('unavailable')).toEqual({
      label: 'Unavailable',
      interactive: false,
      tone: 'preview',
    });
  });
});
