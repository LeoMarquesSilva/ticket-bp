import { describe, expect, it } from 'vitest';
import { getInitialCategoryManagementTab } from './categoryManagementTabs';

describe('getInitialCategoryManagementTab', () => {
  it('abre Comunicações após o callback e rejeita abas desconhecidas', () => {
    expect(getInitialCategoryManagementTab('?tab=comunicacoes&teams=connected')).toBe('comunicacoes');
    expect(getInitialCategoryManagementTab('?tab=https://attacker.invalid')).toBe('categorias');
    expect(getInitialCategoryManagementTab('')).toBe('categorias');
  });
});
