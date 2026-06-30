import { supabase, TABLES } from '@/lib/supabase';
import {
  type CategoriesConfigMap,
  ticketMatchesFrente,
} from '@/utils/ticketFilterUtils';

/** Roles com frente fixa — ignoram tag_id e categorias de outras frentes. */
export const LOCKED_FRENTE_BY_ROLE: Record<string, string> = {
  lawyer: 'juridico',
  advogado: 'juridico',
};

const ROLE_FRENTE_KEY_FALLBACK: Record<string, string> = {
  support: 'juridico',
  suporte: 'juridico',
  ti: 'tecnologia_informacao',
};

export function isStrictFrenteRole(role?: string | null): boolean {
  return Boolean(LOCKED_FRENTE_BY_ROLE[String(role ?? '').trim().toLowerCase()]);
}

/** Suporte operacional: vê somente tickets atribuídos a si (não a frente inteira). */
const ASSIGNED_ONLY_ROLES = new Set(['support', 'suporte']);

export function isAssignedOnlyRole(role?: string | null): boolean {
  return ASSIGNED_ONLY_ROLES.has(String(role ?? '').trim().toLowerCase());
}

export class FrenteAccessService {
  static async resolveFrenteIdByKey(tagKey: string): Promise<string | null> {
    const { data: tagRow } = await supabase
      .from(TABLES.TAGS)
      .select('id')
      .eq('key', tagKey)
      .maybeSingle();

    return tagRow?.id ? (tagRow.id as string) : null;
  }

  /** Resolve as frentes de atuação do usuário (tag_id explícito ou derivação por categorias/role). */
  static async getUserFrenteIds(
    userId: string,
    explicitTagId?: string | null,
    roleHint?: string | null
  ): Promise<string[]> {
    const { data: userRow } = await supabase
      .from(TABLES.USERS)
      .select('tag_id, role')
      .eq('id', userId)
      .maybeSingle();

    const roleKey = String(roleHint ?? userRow?.role ?? '').trim().toLowerCase();
    const lockedTagKey = LOCKED_FRENTE_BY_ROLE[roleKey];
    if (lockedTagKey) {
      const lockedId = await this.resolveFrenteIdByKey(lockedTagKey);
      return lockedId ? [lockedId] : [];
    }

    if (explicitTagId) return [explicitTagId];

    if (userRow?.tag_id) {
      return [userRow.tag_id as string];
    }

    const frenteIds = new Set<string>();

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

    const fallbackTagKey = ROLE_FRENTE_KEY_FALLBACK[roleKey];
    if (!fallbackTagKey) return [];

    const fallbackId = await this.resolveFrenteIdByKey(fallbackTagKey);
    return fallbackId ? [fallbackId] : [];
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

  /** Filtro Supabase: tickets criados por ou atribuídos ao usuário. */
  static buildParticipantOrFilter(userId: string): string {
    return `created_by.eq.${userId},assigned_to.eq.${userId}`;
  }

  /** Filtro Supabase: frente do usuário + tickets que ele criou ou está atendendo. */
  static buildFrenteAccessOrFilter(
    userId: string,
    categoryKeys: string[],
    strictFrenteOnly = false
  ): string {
    const participantParts = [`created_by.eq.${userId}`, `assigned_to.eq.${userId}`];

    if (strictFrenteOnly) {
      if (categoryKeys.length === 0) {
        return participantParts.join(',');
      }
      return [`category.in.(${categoryKeys.join(',')})`, ...participantParts].join(',');
    }

    const parts = [...participantParts];
    if (categoryKeys.length > 0) {
      parts.unshift(`category.in.(${categoryKeys.join(',')})`);
    }
    return parts.join(',');
  }

  static canUserAccessTicket(
    ticket: { category: string; createdBy?: string; assignedTo?: string },
    userId: string,
    categoryKeys: string[],
    strictFrenteOnly = false
  ): boolean {
    if (ticket.createdBy === userId || ticket.assignedTo === userId) return true;

    if (categoryKeys.length === 0) return false;
    return categoryKeys.includes(ticket.category);
  }
}
