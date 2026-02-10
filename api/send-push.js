/**
 * API serverless (Vercel) para enviar Web Push quando há nova mensagem ou ticket.
 * Configure no Supabase: Database Webhook POST para esta URL.
 *
 * Variáveis de ambiente (Vercel):
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - SUPABASE_URL (ex: https://xxx.supabase.co)
 * - SUPABASE_SERVICE_ROLE_KEY
 * - APP_URL (ex: https://seu-dominio.vercel.app) - usado no link da notificação
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const TABLES = {
  TICKETS: 'app_c009c0e4f1_tickets',
  PUSH_SUBSCRIPTIONS: 'app_c009c0e4f1_push_subscriptions',
};

function getEnv(name) {
  const v = process.env[name];
  if (!v) console.warn(`[send-push] Variável ${name} não definida`);
  return v || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const vapidPublic = getEnv('VAPID_PUBLIC_KEY');
  const vapidPrivate = getEnv('VAPID_PRIVATE_KEY');
  const supabaseUrl = getEnv('SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const appUrl = (getEnv('APP_URL') || '').replace(/\/$/, '');

  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !supabaseKey) {
    console.error('[send-push] Configuração incompleta (VAPID ou Supabase)');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  webpush.setVAPIDDetails('mailto:support@example.com', vapidPublic, vapidPrivate);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const type = (body.type || body.eventType || '').toUpperCase();
    const table = body.table || '';
    const record = body.record || body.new || body.payload?.record || body;
    console.log('[send-push] Webhook recebido:', { type, table, hasRecord: !!record?.ticket_id });

    if (
      (table === 'app_c009c0e4f1_chat_messages' || table === 'chat_messages') &&
      (type === 'INSERT' || record.ticket_id)
    ) {
      const ticketId = record.ticket_id;
      const senderUserId = record.user_id;
      const senderName = record.user_name || 'Alguém';
      const messagePreview = (record.message || '').slice(0, 80);

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: ticket, error: ticketError } = await supabase
        .from(TABLES.TICKETS)
        .select('id, title, created_by, assigned_to')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        console.warn('[send-push] Ticket não encontrado:', ticketId);
        return res.status(200).json({ sent: 0 });
      }

      const toNotify = new Set();
      if (ticket.created_by && ticket.created_by !== senderUserId) toNotify.add(ticket.created_by);
      if (ticket.assigned_to && ticket.assigned_to !== senderUserId) toNotify.add(ticket.assigned_to);
      const userIds = [...toNotify];
      if (userIds.length === 0) return res.status(200).json({ sent: 0 });

      const { data: subs } = await supabase
        .from(TABLES.PUSH_SUBSCRIPTIONS)
        .select('subscription')
        .in('user_id', userIds);

      if (!subs || subs.length === 0) return res.status(200).json({ sent: 0 });

      const payload = {
        title: 'Nova mensagem',
        body: `${senderName}: ${messagePreview}${messagePreview.length >= 80 ? '…' : ''}`,
        url: `${appUrl}/tickets/${ticketId}`,
        tag: `msg-${ticketId}`,
      };

      let sent = 0;
      for (const row of subs) {
        const sub = row.subscription;
        if (!sub || !sub.endpoint) continue;
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          sent++;
        } catch (e) {
          if (e.statusCode === 410 || e.statusCode === 404) {
            // Inscrição expirada
          }
          console.warn('[send-push] Erro ao enviar para um subscription:', e.message);
        }
      }
      return res.status(200).json({ sent });
    }

    if (table === 'app_c009c0e4f1_tickets' && (type === 'INSERT' || record.id)) {
      const ticketId = record.id;
      const title = record.title || `Ticket #${(ticketId || '').slice(0, 8)}`;

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: subs } = await supabase
        .from(TABLES.PUSH_SUBSCRIPTIONS)
        .select('subscription');

      if (!subs || subs.length === 0) return res.status(200).json({ sent: 0 });

      const payload = {
        title: 'Novo ticket',
        body: title,
        url: `${appUrl}/tickets/${ticketId}`,
        tag: `ticket-${ticketId}`,
      };

      let sent = 0;
      for (const row of subs) {
        const sub = row.subscription;
        if (!sub || !sub.endpoint) continue;
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          sent++;
        } catch (e) {
          console.warn('[send-push] Erro ao enviar:', e.message);
        }
      }
      return res.status(200).json({ sent });
    }

    return res.status(200).json({ ok: true, message: 'No action' });
  } catch (err) {
    console.error('[send-push]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
