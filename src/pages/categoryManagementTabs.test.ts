import { describe, expect, it } from 'vitest';
import { getInitialCategoryManagementTab } from './categoryManagementTabs';

describe('getInitialCategoryManagementTab', () => {
  it('mantém só taxonomia e respostas e rejeita abas desconhecidas', () => {
    expect(getInitialCategoryManagementTab('?tab=frentes')).toBe('frentes');
    expect(getInitialCategoryManagementTab('?tab=respostas-rapidas')).toBe('respostas-rapidas');
    expect(getInitialCategoryManagementTab('?tab=comunicacoes&teams=connected')).toBe('categorias');
    expect(getInitialCategoryManagementTab('?tab=whatsapp')).toBe('categorias');
    expect(getInitialCategoryManagementTab('?tab=https://attacker.invalid')).toBe('categorias');
    expect(getInitialCategoryManagementTab('')).toBe('categorias');
  });
});
