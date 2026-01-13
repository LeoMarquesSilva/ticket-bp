// Serviço para enviar webhooks (ex: para n8n)
// Permite notificar sistemas externos quando eventos importantes acontecem

interface WebhookPayload {
  event: string;
  data: Record<string, any>;
  timestamp: string;
}

/**
 * Envia um webhook para a URL configurada
 * @param payload - Dados a serem enviados
 * @returns Promise<boolean> - true se enviado com sucesso
 */
export async function sendWebhook(payload: WebhookPayload): Promise<boolean> {
  const webhookUrl = import.meta.env.VITE_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.warn('⚠️ VITE_WEBHOOK_URL não configurada. Webhook não será enviado.');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`❌ Erro ao enviar webhook: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log('✅ Webhook enviado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar webhook:', error);
    return false;
  }
}

/**
 * Envia notificação quando um feedback de detrator (0-7) é recebido
 * @param ticketData - Dados do ticket e feedback
 */
export async function notifyDetractorFeedback(ticketData: {
  ticketId: string;
  ticketTitle: string;
  serviceScore: number;
  comment?: string;
  requestFulfilled: boolean;
  notFulfilledReason?: string;
  createdByName: string;
  createdByEmail?: string;
  assignedToName?: string;
  category?: string;
  subcategory?: string;
  createdAt: string;
  resolvedAt?: string;
  feedbackSubmittedAt: string;
}): Promise<void> {
  const payload: WebhookPayload = {
    event: 'detractor_feedback',
    data: {
      ticket: {
        id: ticketData.ticketId,
        title: ticketData.ticketTitle,
        category: ticketData.category,
        subcategory: ticketData.subcategory,
        createdAt: ticketData.createdAt,
        resolvedAt: ticketData.resolvedAt,
      },
      feedback: {
        serviceScore: ticketData.serviceScore,
        comment: ticketData.comment,
        requestFulfilled: ticketData.requestFulfilled,
        notFulfilledReason: ticketData.notFulfilledReason,
        submittedAt: ticketData.feedbackSubmittedAt,
      },
      user: {
        name: ticketData.createdByName,
        email: ticketData.createdByEmail,
      },
      assignedTo: ticketData.assignedToName,
    },
    timestamp: new Date().toISOString(),
  };

  await sendWebhook(payload);
}
