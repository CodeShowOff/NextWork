export type LayoutSize = 'compact' | 'regular' | 'expanded';

// These mirror the 24dp base space and 16dp inset gutter in the visual token scale.
const minimumBottomSpace = 24;
const insetGutter = 16;

export function resolveLayoutSize(width: number, height: number): LayoutSize {
  const shortestSide = Math.min(width, height);
  return shortestSide < 600 ? 'compact' : shortestSide < 840 ? 'regular' : 'expanded';
}

export function resolveContentBottomInset(safeBottom: number, extra = 0) {
  return Math.max(minimumBottomSpace, safeBottom + insetGutter) + extra;
}
