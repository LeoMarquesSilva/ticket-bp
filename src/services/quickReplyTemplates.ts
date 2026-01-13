// Templates de resposta rápida para o chat de tickets
export interface QuickReplyTemplate {
  id: string;
  label: string;
  message: string;
  category?: string; // Opcional: categoria do ticket para templates específicos
}

// Templates padrão disponíveis para todos os atendentes
export const QUICK_REPLY_TEMPLATES: QuickReplyTemplate[] = [
  {
    id: 'greeting',
    label: 'Saudação inicial',
    message: 'Olá! Recebi sua solicitação e vou verificar para você. Retorno em breve.'
  },
  {
    id: 'checking',
    label: 'Verificando',
    message: 'Vou verificar e retorno em breve com as informações solicitadas.'
  },
  {
    id: 'wait',
    label: 'Aguarde',
    message: 'Aguarde um momento enquanto verifico sua solicitação.'
  },
  {
    id: 'thank-you',
    label: 'Agradecimento',
    message: 'Obrigado pela sua solicitação. Estamos trabalhando para resolver o mais rápido possível.'
  },
  {
    id: 'resolved',
    label: 'Resolvido',
    message: 'Sua solicitação foi resolvida! Por favor, confirme se está tudo ok ou se precisa de mais alguma coisa.'
  },
  {
    id: 'info-needed',
    label: 'Precisa de informações',
    message: 'Para prosseguir com sua solicitação, preciso de algumas informações adicionais. Poderia me fornecer?'
  },
  {
    id: 'closing',
    label: 'Encerramento',
    message: 'Fico à disposição para qualquer outra dúvida. Tenha um ótimo dia!'
  },
  {
    id: 'follow-up',
    label: 'Acompanhamento',
    message: 'Estou acompanhando sua solicitação. Assim que tiver novidades, retorno o contato.'
  }
];

// Função para obter templates por categoria (opcional - para futuras expansões)
export function getTemplatesByCategory(category?: string): QuickReplyTemplate[] {
  if (!category) {
    return QUICK_REPLY_TEMPLATES;
  }
  
  // Por enquanto, retorna todos os templates
  // No futuro, pode filtrar templates específicos por categoria
  return QUICK_REPLY_TEMPLATES;
}
