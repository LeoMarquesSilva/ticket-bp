import { describe, expect, it } from 'vitest';
import {
  getInitialInterfaceDensity,
  getInitialSidebarCollapsed,
  shouldOpenTicketFiltersInitially,
} from './layoutPreferences';

describe('layout preferences', () => {
  it('preserves an explicit collapsed sidebar preference at any viewport width', () => {
    expect(getInitialSidebarCollapsed('1', 1920)).toBe(true);
  });

  it('preserves an explicit expanded sidebar preference at a narrow desktop width', () => {
    expect(getInitialSidebarCollapsed('0', 1024)).toBe(false);
  });

  it('collapses the sidebar by default on notebooks and expands it on wide monitors', () => {
    expect(getInitialSidebarCollapsed(null, 1366)).toBe(true);
    expect(getInitialSidebarCollapsed(null, 1920)).toBe(false);
  });

  it('uses comfortable density unless the user explicitly selected compact density', () => {
    expect(getInitialInterfaceDensity(null)).toBe('comfortable');
    expect(getInitialInterfaceDensity('comfortable')).toBe('comfortable');
    expect(getInitialInterfaceDensity('compact')).toBe('compact');
    expect(getInitialInterfaceDensity('invalid')).toBe('comfortable');
  });

  it('opens filters initially only on genuinely tall non-mobile viewports', () => {
    expect(shouldOpenTicketFiltersInitially(1099, 1920)).toBe(false);
    expect(shouldOpenTicketFiltersInitially(1200, 767)).toBe(false);
    expect(shouldOpenTicketFiltersInitially(1100, 768)).toBe(true);
  });
});
