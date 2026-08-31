import { describe, expect, it } from 'vitest';
import {
  getInitialSettingsTab,
  getSettingsRedirectFromCategorySearch,
} from './settingsTabs';

describe('settingsTabs', () => {
  it('abre Comunicações ou WhatsApp e rejeita aba desconhecida', () => {
    expect(getInitialSettingsTab('?tab=comunicacoes&teams=connected')).toBe('comunicacoes');
    expect(getInitialSettingsTab('?tab=quando-enviar')).toBe('quando-enviar');
    expect(getInitialSettingsTab('?tab=whatsapp')).toBe('whatsapp');
    expect(getInitialSettingsTab('?tab=https://attacker.invalid')).toBe('comunicacoes');
    expect(getInitialSettingsTab('')).toBe('comunicacoes');
  });

  it('redireciona abas antigas de categorias para configurações', () => {
    expect(getSettingsRedirectFromCategorySearch('?tab=comunicacoes&teams=connected'))
      .toBe('/settings?tab=comunicacoes&teams=connected');
    expect(getSettingsRedirectFromCategorySearch('?tab=whatsapp')).toBe('/settings?tab=whatsapp');
    expect(getSettingsRedirectFromCategorySearch('?tab=categorias')).toBeNull();
    expect(getSettingsRedirectFromCategorySearch('')).toBeNull();
  });
});
