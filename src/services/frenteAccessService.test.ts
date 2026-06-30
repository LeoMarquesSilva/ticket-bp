import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: {},
  TABLES: { TAGS: 'tags', USERS: 'users', CATEGORIES: 'categories', SUBCATEGORIES: 'subcategories' },
}));

import { FrenteAccessService } from './frenteAccessService';

describe('FrenteAccessService', () => {
  const userId = 'user-123';
  const categoryKeys = ['juridico', 'contratos'];

  describe('buildFrenteAccessOrFilter', () => {
    it('inclui tickets criados/atribuídos mesmo em modo strict', () => {
      const filter = FrenteAccessService.buildFrenteAccessOrFilter(userId, categoryKeys, true);
      expect(filter).toContain(`created_by.eq.${userId}`);
      expect(filter).toContain(`assigned_to.eq.${userId}`);
      expect(filter).toContain('category.in.(juridico,contratos)');
    });

    it('sem categorias em modo strict retorna só participação do usuário', () => {
      const filter = FrenteAccessService.buildFrenteAccessOrFilter(userId, [], true);
      expect(filter).toBe(`created_by.eq.${userId},assigned_to.eq.${userId}`);
    });
  });

  describe('canUserAccessTicket', () => {
    it('permite acesso quando o usuário é solicitante, mesmo fora da frente', () => {
      const allowed = FrenteAccessService.canUserAccessTicket(
        { category: 'marketing', createdBy: userId },
        userId,
        categoryKeys,
        true
      );
      expect(allowed).toBe(true);
    });

    it('permite acesso quando o usuário é responsável, mesmo fora da frente', () => {
      const allowed = FrenteAccessService.canUserAccessTicket(
        { category: 'marketing', assignedTo: userId },
        userId,
        categoryKeys,
        true
      );
      expect(allowed).toBe(true);
    });

    it('nega acesso a ticket de outra frente sem participação do usuário', () => {
      const allowed = FrenteAccessService.canUserAccessTicket(
        { category: 'marketing', createdBy: 'other-user' },
        userId,
        categoryKeys,
        true
      );
      expect(allowed).toBe(false);
    });
  });
});
