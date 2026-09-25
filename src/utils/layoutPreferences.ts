export type InterfaceDensity = 'comfortable' | 'compact';

const WIDE_DESKTOP_MIN_WIDTH = 1440;
const TALL_VIEWPORT_MIN_HEIGHT = 1100;
const TABLET_MIN_WIDTH = 768;

export function getInitialSidebarCollapsed(storedValue: string | null, viewportWidth: number) {
  if (storedValue === '1') return true;
  if (storedValue === '0') return false;
  return viewportWidth < WIDE_DESKTOP_MIN_WIDTH;
}

export function getInitialInterfaceDensity(storedValue: string | null): InterfaceDensity {
  return storedValue === 'compact' ? 'compact' : 'comfortable';
}

export function shouldOpenTicketFiltersInitially(viewportHeight: number, viewportWidth: number) {
  return viewportHeight >= TALL_VIEWPORT_MIN_HEIGHT && viewportWidth >= TABLET_MIN_WIDTH;
}
