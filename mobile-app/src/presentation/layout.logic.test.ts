import { resolveContentBottomInset, resolveLayoutSize } from './layout.logic';

describe('adaptive layout rules', () => {
  it('uses the short side so landscape phones retain compact navigation', () => {
    expect(resolveLayoutSize(844, 390)).toBe('compact');
  });

  it('selects regular and expanded tablet layouts at the documented breakpoints', () => {
    expect(resolveLayoutSize(768, 1024)).toBe('regular');
    expect(resolveLayoutSize(1024, 1366)).toBe('expanded');
  });

  it('always reserves a usable bottom inset for gesture navigation', () => {
    expect(resolveContentBottomInset(0)).toBeGreaterThanOrEqual(24);
    expect(resolveContentBottomInset(32, 8)).toBe(56);
  });
});
