export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

export function buildTicketUrl(base, ticketId, feedback) {
  const root = String(base).replace(/\/$/, '');
  return `${root}/tickets/${encodeURIComponent(ticketId)}${feedback ? '?showFeedback=true' : ''}`;
}

export function buildNotificationContent({ type, ticket, requester, appBaseUrl }) {
  const feedback = type !== 'awaiting_requester';
  const webUrl = buildTicketUrl(appBaseUrl, ticket.id, feedback);
  const copy = {
    resolved_feedback_invite: {
      subject: `Avalie o atendimento: ${ticket.title}`,
      action: 'Avaliar atendimento',
      reason: 'Seu chamado foi finalizado.',
    },
    awaiting_requester: {
      subject: `Seu chamado aguarda uma resposta: ${ticket.title}`,
      action: 'Responder chamado',
      reason: 'O suporte aguarda sua resposta há mais de 48 horas.',
    },
    awaiting_feedback: {
      subject: `Avaliação pendente: ${ticket.title}`,
      action: 'Avaliar atendimento',
      reason: 'Seu chamado foi finalizado há mais de 72 horas e ainda não foi avaliado.',
    },
  }[type];
  const safeName = escapeHtml(requester.name);
  const safeTitle = escapeHtml(ticket.title);
  const html = `<p>Olá, ${safeName}.</p><p>${escapeHtml(copy.reason)}</p><p><strong>${safeTitle}</strong></p><p><a href="${escapeHtml(webUrl)}">${escapeHtml(copy.action)}</a></p><p>${escapeHtml(webUrl)}</p>`;
  const text = `Olá, ${requester.name}.\n\n${copy.reason}\n\n${ticket.title}\n\n${copy.action}: ${webUrl}`;

  return {
    email: { subject: copy.subject, html, text },
    teams: { topic: ticket.title, previewText: copy.reason, webUrl },
  };
}
