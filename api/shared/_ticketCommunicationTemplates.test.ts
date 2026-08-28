import { describe, expect, it } from 'vitest';
import {
  buildNotificationContent,
  EMAIL_TEMPLATE_DEFAULTS,
  TEAMS_TEMPLATE_DEFAULTS,
  escapeHtml,
  greetingName,
  normalizeEmailTemplateOverrides,
  normalizeTeamsTemplateOverrides,
  normalizeAppPublicUrl,
} from '../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';

const ticket = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Acesso ao sistema',
};
const requester = { name: 'Ana' };

describe('buildNotificationContent', () => {
  it('renderiza um e-mail Responsum completo e compatível com clientes corporativos', () => {
    const content = buildNotificationContent({
      type: 'resolved_feedback_invite',
      ticket,
      requester,
      appBaseUrl: 'https://responsum.example',
    });

    expect(content.email.html).toContain('role="presentation"');
    expect(content.email.html).toContain('RESPONSUM');
    expect(content.email.html).toContain('#F69F19');
    expect(content.email.html).toContain('Avaliar atendimento');
    expect(content.email.html).toContain('Abrir chamado no Responsum');
    expect(content.email.html).toContain('Caso o botão não funcione');
    expect(content.email.html).toContain('width:100%');
    expect(content.email.text).toContain('RESPONSUM | AVISO DE CHAMADO');
  });

  it('aplica somente textos saneados e mantém URL e destinatário fora da configuração', () => {
    const overrides = normalizeEmailTemplateOverrides({
      awaiting_requester: {
        subject: 'Precisamos de você',
        reason: 'Responda para continuarmos <agora>.',
        action: 'Continuar atendimento',
        ticketUrl: 'https://malicioso.example',
      },
    });
    const content = buildNotificationContent({
      type: 'awaiting_requester', ticket, requester,
      appBaseUrl: 'https://responsum.example', emailTemplateOverrides: overrides,
    });

    expect(content.email.subject).toBe('Precisamos de você');
    expect(content.email.html).toContain('Responda para continuarmos &lt;agora&gt;.');
    expect(content.email.html).toContain('Continuar atendimento');
    expect(content.email.html).not.toContain('malicioso.example');
    expect(content.teams).toMatchObject({
      label: 'Responder chamado',
      previewText: 'O suporte aguarda sua resposta há mais de 48 horas.',
    });
    expect(content.teams.html).not.toContain('Continuar atendimento');
  });

  it('aplica textos saneados do Teams sem misturar com o e-mail nem aceitar URL', () => {
    const teamsOverrides = normalizeTeamsTemplateOverrides({
      awaiting_requester: {
        subject: 'Responsum precisa de você: {title}',
        reason: 'Responda no Teams <agora>.',
        action: 'Abrir no Responsum',
        ticketUrl: 'https://malicioso.example',
      },
    });
    const content = buildNotificationContent({
      type: 'awaiting_requester',
      ticket,
      requester,
      appBaseUrl: 'https://responsum.example',
      teamsTemplateOverrides: teamsOverrides,
    });

    expect(content.email.subject).toBe('Seu chamado aguarda uma resposta: Acesso ao sistema');
    expect(content.teams.previewText).toBe('Responda no Teams <agora>.');
    expect(content.teams.label).toBe('Abrir no Responsum');
    expect(content.teams.html).toContain('RESPONSUM');
    expect(content.teams.html).toContain('Responda no Teams &lt;agora&gt;.');
    expect(content.teams.html).toContain('Abrir no Responsum');
    expect(content.teams.html).toContain('https://responsum.example/tickets/11111111-1111-1111-1111-111111111111');
    expect(content.teams.html).not.toContain('malicioso.example');
    expect(content.teams.chatHtml).toBe('<p><strong>RESPONSUM</strong> · Abrir no Responsum</p><p>Responda no Teams &lt;agora&gt;.</p>');
    expect(content.teams.card.msteams).toEqual({ width: 'Full' });
    expect(content.teams.card.body[0]).toEqual(expect.objectContaining({
      type: 'Container',
      bleed: true,
      backgroundImage: {
        url: 'https://responsum.example/teams-header-orange.png',
        fillMode: 'Cover',
      },
    }));
    expect(JSON.stringify(content.teams.card)).toContain('FactSet');
    expect(JSON.stringify(content.teams.card)).toContain('Abrir no Responsum');
    expect(JSON.stringify(content.teams.card)).not.toContain('malicioso.example');
  });

  it('descarta configuração inválida por campo e preserva os defaults versionados', () => {
    const overrides = normalizeEmailTemplateOverrides({
      resolved_feedback_invite: {
        subject: 'x'.repeat(141),
        reason: '',
        action: 'y'.repeat(49),
      },
      unknown: { subject: 'não usar' },
    });

    expect(overrides).toEqual({});
    expect(normalizeTeamsTemplateOverrides({
      resolved_feedback_invite: { subject: 'x'.repeat(141), action: 'y'.repeat(49) },
    })).toEqual({});
    expect(EMAIL_TEMPLATE_DEFAULTS.awaiting_feedback.action).toBe('Avaliar atendimento');
    expect(TEAMS_TEMPLATE_DEFAULTS.awaiting_feedback.action).toBe('Avaliar atendimento');
  });

  it('cria link de avaliação para convite e lembrete de feedback', () => {
    const content = buildNotificationContent({
      type: 'awaiting_feedback',
      ticket: { ...ticket, title: 'Acesso <urgente>' },
      requester: { name: 'Ana & Cia' },
      appBaseUrl: 'https://responsum.example/',
    });

    expect(content.teams.ticketUrl).toBe('https://responsum.example/tickets/11111111-1111-1111-1111-111111111111?showFeedback=true');
    expect(content.teams.label).toBe('Avaliar atendimento');
    expect(content.email.html).toContain('Acesso &lt;urgente&gt;');
    expect(content.email.html).toContain('Olá, <strong style="color:#2C2D2F;">Ana</strong>.');
    expect(content.email.html).not.toContain('Ana &amp; Cia');
    expect(content.email.html).not.toContain('Acesso <urgente>');
  });

  it('cumprimenta pelo primeiro nome e pinta o cabeçalho do Teams com o laranja Responsum', () => {
    expect(greetingName('Samuel Willian Silva')).toBe('Samuel');
    expect(greetingName('  ana\nmarques  ')).toBe('ana');
    expect(greetingName('')).toBe('');

    const content = buildNotificationContent({
      type: 'awaiting_requester',
      ticket,
      requester: { name: 'Samuel Willian Silva' },
      appBaseUrl: 'https://responsum.example',
    });
    const header = content.teams.card.body[0];

    expect(content.teams.card.body.some((item) => item.text === 'Olá, Samuel.')).toBe(true);
    expect(JSON.stringify(content.teams.card)).not.toContain('Olá, você.');
    expect(header.style).toBeUndefined();
    expect(header.backgroundImage).toEqual({
      url: 'https://responsum.example/teams-header-orange.png',
      fillMode: 'Cover',
    });
    expect(content.teams.card.body.at(-1)).toEqual(expect.objectContaining({
      type: 'TextBlock',
      text: '*Mensagem automática do Responsum. Não é necessário responder neste chat.*',
      isSubtle: true,
      size: 'Small',
    }));
    expect(content.teams.html).toContain('<em>Mensagem automática do Responsum. Não é necessário responder neste chat.</em>');
  });

  it('usa o chamado sem showFeedback no lembrete de resposta', () => {
    const content = buildNotificationContent({
      type: 'awaiting_requester',
      ticket,
      requester,
      appBaseUrl: 'https://responsum.example',
    });

    expect(content.teams.ticketUrl).toBe('https://responsum.example/tickets/11111111-1111-1111-1111-111111111111');
    expect(content.email.subject).toBe('Seu chamado aguarda uma resposta: Acesso ao sistema');
    expect(content.email.text).toContain('Responder chamado: https://responsum.example/tickets/11111111-1111-1111-1111-111111111111');
  });

  it.each([
    ['resolved_feedback_invite', 'Avalie o atendimento: Acesso ao sistema', 'Seu chamado foi finalizado.', 'Avaliar atendimento'],
    ['awaiting_requester', 'Seu chamado aguarda uma resposta: Acesso ao sistema', 'O suporte aguarda sua resposta há mais de 48 horas.', 'Responder chamado'],
    ['awaiting_feedback', 'Avaliação pendente: Acesso ao sistema', 'Seu chamado foi finalizado há mais de 72 horas e ainda não foi avaliado.', 'Avaliar atendimento'],
  ])('cria o conteúdo específico de %s', (type, subject, reason, action) => {
    const content = buildNotificationContent({ type, ticket, requester, appBaseUrl: 'https://responsum.example' });

    expect(content.email.subject).toBe(subject);
    expect(content.email.text).toContain(reason);
    expect(content.email.text).toContain(action);
    expect(content.teams).toMatchObject({ topic: ticket.title, previewText: reason });
  });
});

it('escapa todos os caracteres especiais em HTML', () => {
  expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
});

describe('normalizeAppPublicUrl', () => {
  it('preserva uma base path e remove barras redundantes', () => {
    expect(normalizeAppPublicUrl('https://responsum.example/helpdesk///'))
      .toBe('https://responsum.example/helpdesk');
  });

  it.each([
    'http://responsum.example',
    'https://user@responsum.example',
    'https://responsum.example/?source=wrong',
    'https://responsum.example/#wrong',
  ])('rejeita base pública inválida: %s', (value) => {
    expect(() => normalizeAppPublicUrl(value)).toThrow('APP_PUBLIC_URL');
  });
});
