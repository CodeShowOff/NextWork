export type CapabilityState = 'live' | 'preview' | 'unavailable';

export function capabilityCopy(state: CapabilityState) {
  switch (state) {
    case 'live':
      return { label: 'Available', interactive: true, tone: 'standard' as const };
    case 'preview':
      return { label: 'Preview', interactive: true, tone: 'preview' as const };
    default:
      return { label: 'Unavailable', interactive: false, tone: 'preview' as const };
  }
}
