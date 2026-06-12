import { supabase, TABLES } from '@/lib/supabase';
import {
  type CategoriesConfigMap,
  ticketMatchesFrente,
} from '@/utils/ticketFilterUtils';

const ROLE_FRENTE_KEY_FALLBACK: Record<string, string> = {
  lawyer: 'juridico',
  advogado: 'juridico',
  support: 'juridico',
  suporte: 'juridico',
  ti: 'tecnologia_informacao',
};

export class FrenteAccessService {
  /** Resolve as frentes de atuação do usuário (tag_id explícito ou derivação por categorias/role). */
  static async getUserFrenteIds(userId: string, explicitTagId?: string | null): Promise<string[]> {
    if (explicitTagId) return [explicitTagId];

    const frenteIds = new Set<string>();

    const { data: userRow } = await supabase
      .from(TABLES.USERS)
      .select('tag_id, role')
      .eq('id', userId)
      .maybeSingle();

    if (userRow?.tag_id) {
      return [userRow.tag_id as string];
    }

    const [{ data: categoryRows }, { data: subcategoryRows }] = await Promise.all([
      supabase
        .from(TABLES.CATEGORIES)
        .select('tag_id')
        .eq('default_assigned_to', userId)
        .not('tag_id', 'is', null),
      supabase
        .from(TABLES.SUBCATEGORIES)
        .select('category_id')
        .eq('default_assigned_to', userId),
    ]);

    (categoryRows || []).forEach((row: { tag_id?: string | null }) => {
      if (row.tag_id) frenteIds.add(row.tag_id);
    });

    const categoryIds = [...new Set((subcategoryRows || []).map((r: { category_id: string }) => r.category_id))];
    if (categoryIds.length > 0) {
      const { data: parentCategories } = await supabase
        .from(TABLES.CATEGORIES)
        .select('tag_id')
        .in('id', categoryIds)
        .not('tag_id', 'is', null);

      (parentCategories || []).forEach((row: { tag_id?: string | null }) => {
        if (row.tag_id) frenteIds.add(row.tag_id);
      });
    }

    if (frenteIds.size > 0) {
      return [...frenteIds];
    }

    const roleKey = String(userRow?.role ?? '').trim().toLowerCase();
    const fallbackTagKey = ROLE_FRENTE_KEY_FALLBACK[roleKey];
    if (!fallbackTagKey) return [];

    const { data: tagRow } = await supabase
      .from(TABLES.TAGS)
      .select('id')
      .eq('key', fallbackTagKey)
      .maybeSingle();

    return tagRow?.id ? [tagRow.id as string] : [];
  }

  static ticketMatchesUserFrentes(
    ticketCategory: string,
    frenteIds: string[],
    categoriesConfig: CategoriesConfigMap
  ): boolean {
    if (frenteIds.length === 0) return false;
    return frenteIds.some((frenteId) =>
      ticketMatchesFrente(ticketCategory, frenteId, categoriesConfig)
    );
  }

  /** Filtro Supabase: frente do usuário + tickets que ele criou ou está atendendo. */
  static buildFrenteAccessOrFilter(userId: string, categoryKeys: string[]): string {
    const parts = [`created_by.eq.${userId}`, `assigned_to.eq.${userId}`];
    if (categoryKeys.length > 0) {
      parts.unshift(`category.in.(${categoryKeys.join(',')})`);
    }
    return parts.join(',');
  }

  static canUserAccessTicket(
    ticket: { category: string; createdBy?: string; assignedTo?: string },
    userId: string,
    categoryKeys: string[]
  ): boolean {
    if (ticket.createdBy === userId || ticket.assignedTo === userId) return true;
    if (categoryKeys.length === 0) return false;
    return categoryKeys.includes(ticket.category);
  }
}
