import { supabase, TABLES } from '@/lib/supabase';

// Templates de resposta rápida para o chat de tickets
export interface QuickReplyTemplate {
  id: string;
  label: string;
  message: string;
  order: number;
}

export interface QuickReplyTemplateInput {
  label: string;
  message: string;
}

/** Usado apenas se a consulta ao banco falhar (ex.: instabilidade de rede). */
const FALLBACK_TEMPLATES: QuickReplyTemplate[] = [
  { id: 'fallback-greeting', label: 'Saudação inicial', message: 'Olá! Recebi sua solicitação e vou verificar para você. Retorno em breve.', order: 1 },
  { id: 'fallback-checking', label: 'Verificando', message: 'Vou verificar e retorno em breve com as informações solicitadas.', order: 2 },
];

function mapFromDb(row: any): QuickReplyTemplate {
  return {
    id: row.id,
    label: row.label,
    message: row.message,
    order: row.order ?? 0,
  };
}

export class QuickReplyTemplateService {
  static async getAll(): Promise<QuickReplyTemplate[]> {
    try {
      const { data, error } = await supabase
        .from(TABLES.QUICK_REPLY_TEMPLATES)
        .select('*')
        .order('order', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapFromDb);
    } catch (error) {
      console.error('Erro ao buscar respostas rápidas:', error);
      return FALLBACK_TEMPLATES;
    }
  }

  static async create(input: QuickReplyTemplateInput): Promise<QuickReplyTemplate> {
    const { data: lastRow } = await supabase
      .from(TABLES.QUICK_REPLY_TEMPLATES)
      .select('order')
      .order('order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const order = (lastRow?.order ?? 0) + 1;

    const { data, error } = await supabase
      .from(TABLES.QUICK_REPLY_TEMPLATES)
      .insert({ label: input.label, message: input.message, order })
      .select()
      .single();
    if (error) throw error;
    return mapFromDb(data);
  }

  static async update(id: string, input: QuickReplyTemplateInput): Promise<QuickReplyTemplate> {
    const { data, error } = await supabase
      .from(TABLES.QUICK_REPLY_TEMPLATES)
      .update({ label: input.label, message: input.message, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapFromDb(data);
  }

  static async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLES.QUICK_REPLY_TEMPLATES).delete().eq('id', id);
    if (error) throw error;
  }

  static async reorder(items: Array<{ id: string; order: number }>): Promise<void> {
    await Promise.all(
      items.map(({ id, order }) =>
        supabase.from(TABLES.QUICK_REPLY_TEMPLATES).update({ order }).eq('id', id),
      ),
    );
  }
}
