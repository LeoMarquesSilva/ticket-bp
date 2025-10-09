import { supabase, TABLES } from '@/lib/supabase';

// Método para verificar se um ticket específico precisa de feedback
export async function checkTicketNeedsFeedback(ticketId: string): Promise<boolean> {
  try {
    console.log('Verificando se o ticket precisa de feedback:', ticketId);
    
    const { data, error } = await supabase
      .from(TABLES.TICKETS)
      .select('status, feedback_submitted_at')
      .eq('id', ticketId)
      .single();

    if (error) {
      console.error('Erro ao verificar status de feedback do ticket:', error);
      throw error;
    }

    // O ticket precisa de feedback se estiver resolvido e não tiver feedback enviado
    return data && data.status === 'resolved' && !data.feedback_submitted_at;
  } catch (error) {
    console.error('Erro em checkTicketNeedsFeedback:', error);
    return false; // Em caso de erro, assumimos que não precisa de feedback
  }
}

// Adicione este método à classe TicketService
if (typeof window !== 'undefined') {
  // Verificamos se estamos no navegador para evitar erros no SSR
  import('./ticketService').then(({ TicketService }) => {
    // @ts-ignore - Adicionando método dinamicamente
    TicketService.checkTicketNeedsFeedback = checkTicketNeedsFeedback;
  }).catch(err => console.error('Erro ao estender TicketService:', err));
}