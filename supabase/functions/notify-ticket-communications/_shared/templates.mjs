export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

export function normalizeAppPublicUrl(value) {
  let url;
  try {
    url = new URL(String(value ?? '').trim());
  } catch {
    throw new TypeError('APP_PUBLIC_URL must be a valid HTTPS URL');
  }
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new TypeError('APP_PUBLIC_URL must be HTTPS without userinfo, query, or fragment');
  }

  const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return `${url.origin}${pathname === '/' ? '' : pathname}`;
}

export function buildTicketUrl(base, ticketId, feedback) {
  const root = normalizeAppPublicUrl(base);
  return `${root}/tickets/${encodeURIComponent(ticketId)}${feedback ? '?showFeedback=true' : ''}`;
}

export const EMAIL_TEMPLATE_DEFAULTS = Object.freeze({
  resolved_feedback_invite: Object.freeze({
    subject: 'Avalie o atendimento: {title}',
    reason: 'Seu chamado foi finalizado.',
    action: 'Avaliar atendimento',
  }),
  awaiting_requester: Object.freeze({
    subject: 'Seu chamado aguarda uma resposta: {title}',
    reason: 'O suporte aguarda sua resposta há mais de 48 horas.',
    action: 'Responder chamado',
  }),
  awaiting_feedback: Object.freeze({
    subject: 'Avaliação pendente: {title}',
    reason: 'Seu chamado foi finalizado há mais de 72 horas e ainda não foi avaliado.',
    action: 'Avaliar atendimento',
  }),
});

const EMAIL_FIELD_LIMITS = Object.freeze({ subject: 140, reason: 320, action: 48 });

export function normalizeEmailTemplateOverrides(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  for (const type of Object.keys(EMAIL_TEMPLATE_DEFAULTS)) {
    const input = value[type];
    if (!input || typeof input !== 'object' || Array.isArray(input)) continue;
    const fields = {};
    for (const [field, limit] of Object.entries(EMAIL_FIELD_LIMITS)) {
      const text = typeof input[field] === 'string' ? input[field].trim() : '';
      if (text && text.length <= limit && !/[\r\n]/.test(text)) fields[field] = text;
    }
    if (Object.keys(fields).length > 0) normalized[type] = fields;
  }
  return normalized;
}

function resolveCopy(type, ticketTitle, overrides) {
  const defaults = EMAIL_TEMPLATE_DEFAULTS[type];
  if (!defaults) throw new TypeError(`Unsupported ticket communication type: ${type}`);
  const custom = normalizeEmailTemplateOverrides(overrides)[type] ?? {};
  const copy = { ...defaults, ...custom };
  return {
    ...copy,
    subject: copy.subject.replaceAll('{title}', ticketTitle),
  };
}

function renderEmailHtml({ name, title, reason, action, webUrl, type }) {
  const safeName = escapeHtml(name);
  const safeTitle = escapeHtml(title);
  const safeReason = escapeHtml(reason);
  const safeAction = escapeHtml(action);
  const safeUrl = escapeHtml(webUrl);
  const state = type === 'awaiting_requester'
    ? { label: 'RESPOSTA NECESSÁRIA', color: '#DE5532', intro: 'Precisamos de você para continuar' }
    : type === 'awaiting_feedback'
      ? { label: 'AVALIAÇÃO PENDENTE', color: '#BD2D29', intro: 'Sua opinião faz diferença' }
      : { label: 'CHAMADO FINALIZADO', color: '#F69F19', intro: 'Atendimento concluído' };

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${safeTitle}</title></head>
<body style="margin:0;padding:0;background-color:#F1F3F5;color:#2C2D2F;font-family:Montserrat,Arial,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeReason}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background-color:#F1F3F5;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #E2E5E9;border-radius:16px;overflow:hidden;box-shadow:0 12px 32px rgba(44,45,47,.08);">
<tr><td style="height:5px;font-size:0;line-height:0;background:#F69F19;background:linear-gradient(90deg,#F69F19 0%,#DE5532 52%,#BD2D29 100%);">&nbsp;</td></tr>
<tr><td style="padding:25px 32px;background:#2C2D2F;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td>
<div style="font-size:21px;line-height:24px;font-weight:700;letter-spacing:2.2px;color:#FFFFFF;">RESPONSUM</div>
<div style="margin-top:5px;font-size:11px;line-height:16px;letter-spacing:1.3px;color:#BFC3C8;">BIS MARCHI PIRES · SISTEMA DE ATENDIMENTO</div>
</td><td align="right" style="font-size:11px;color:#D9DCE0;">AVISO DE CHAMADO</td></tr></table>
</td></tr>
<tr><td style="padding:34px 32px 12px;">
<div style="display:inline-block;padding:7px 11px;border-radius:999px;background:${state.color}18;color:${state.color};font-size:11px;line-height:14px;font-weight:700;letter-spacing:.8px;">${state.label}</div>
<h1 style="margin:18px 0 10px;font-size:26px;line-height:33px;font-weight:700;color:#2C2D2F;">${state.intro}</h1>
<p style="margin:0;font-size:16px;line-height:26px;color:#5C6168;">Olá, <strong style="color:#2C2D2F;">${safeName}</strong>.</p>
<p style="margin:14px 0 0;font-size:16px;line-height:26px;color:#5C6168;">${safeReason}</p>
</td></tr>
<tr><td style="padding:18px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:1px solid #E5E7EA;border-left:4px solid ${state.color};border-radius:10px;background:#FAFAFB;"><tr><td style="padding:18px 20px;">
<div style="font-size:11px;line-height:14px;color:#8A9098;letter-spacing:.8px;font-weight:700;">CHAMADO</div>
<div style="margin-top:7px;font-size:17px;line-height:24px;color:#2C2D2F;font-weight:600;word-break:break-word;">${safeTitle}</div>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:22px 32px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#F69F19" style="border-radius:9px;background:#F69F19;">
<a href="${safeUrl}" style="display:inline-block;padding:15px 28px;font-size:15px;line-height:20px;font-weight:700;color:#2C2D2F;text-decoration:none;border-radius:9px;">${safeAction} &nbsp;→</a>
</td></tr></table>
<p style="margin:15px 0 0;font-size:12px;line-height:18px;color:#8A9098;">Abrir chamado no Responsum</p>
</td></tr>
<tr><td style="padding:20px 32px 30px;">
<div style="padding-top:18px;border-top:1px solid #ECEDEF;font-size:12px;line-height:19px;color:#8A9098;">Caso o botão não funcione, copie e cole este endereço no navegador:<br><a href="${safeUrl}" style="color:#BD2D29;text-decoration:underline;word-break:break-all;">${safeUrl}</a></div>
</td></tr>
<tr><td style="padding:20px 32px;background:#F7F7F8;border-top:1px solid #ECEDEF;font-size:11px;line-height:18px;color:#7A7F86;">Esta é uma mensagem automática do Responsum. Por segurança, acesse o chamado somente pelo link acima e não compartilhe informações sensíveis por e-mail.</td></tr>
</table>
<div style="padding:18px 8px 0;font-size:11px;line-height:17px;color:#9AA0A7;text-align:center;">Bismarchi Pires · Operações Jurídicas</div>
</td></tr></table></body></html>`;
}

export function buildNotificationContent({ type, ticket, requester, appBaseUrl, emailTemplateOverrides }) {
  const feedback = type !== 'awaiting_requester';
  const webUrl = buildTicketUrl(appBaseUrl, ticket.id, feedback);
  const copy = resolveCopy(type, ticket.title, emailTemplateOverrides);
  const html = renderEmailHtml({
    name: requester.name, title: ticket.title, reason: copy.reason,
    action: copy.action, webUrl, type,
  });
  const text = `RESPONSUM | AVISO DE CHAMADO\n\nOlá, ${requester.name}.\n\n${copy.reason}\n\nChamado: ${ticket.title}\n\n${copy.action}: ${webUrl}\n\nBismarchi Pires · Operações Jurídicas`;

  return {
    email: { subject: copy.subject, html, text },
    teams: {
      topic: ticket.title,
      label: copy.action,
      previewText: copy.reason,
      ticketUrl: webUrl,
    },
  };
}
