/**
 * API serverless (Vercel) para enviar Web Push quando há nova mensagem ou ticket.
 * Regras de destinatário: api/shared/notificationRules.mjs (espelho de notificationAccessUtils.ts).
 */

import { createRequire } from 'module';
import {
  getMessageRecipientUserIds,
  getNewTicketRecipientUserIds,
  normalizeNotifyUserId,
  shouldNotifyTicketAssigned,
} from './shared/notificationRules.mjs';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

const TABLES = {
  TICKETS: 'app_c009c0e4f1_tickets',
  PUSH_SUBSCRIPTIONS: 'app_c009c0e4f1_push_subscriptions',
  USERS: 'app_c009c0e4f1_users',
  CATEGORIES: 'app_c009c0e4f1_categories',
  TAGS: 'app_c009c0e4f1_tags',
  ROLES: 'app_c009c0e4f1_roles',
  ROLE_PERMISSIONS: 'app_c009c0e4f1_role_permissions',
};

function getEnv(name) {
  const v = process.env[name];
  if (!v) console.warn(`[send-push] Variável ${name} não definida`);
  return v || '';
}

function getOptionalEnv(name) {
  return process.env[name] || '';
}

function getSecretFromRequest(req) {
  const byHeader = req.headers['x-webhook-secret'];
  if (typeof byHeader === 'string' && byHeader.trim()) return byHeader.trim();
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

function isExpiredSubscriptionError(error) {
  return error?.statusCode === 404 || error?.statusCode === 410;
}

function toCategoryKeysByTagId(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const tagId = normalizeNotifyUserId(row.tag_id);
    const categoryKey = String(row.key ?? '').trim();
    if (!tagId || !categoryKey) continue;
    const existing = map.get(tagId) ?? [];
    if (!existing.includes(categoryKey)) existing.push(categoryKey);
    map.set(tagId, existing);
  }
  return map;
}

function toTagIdByKey(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const key = String(row.key ?? '').trim().toLowerCase();
    const id = normalizeNotifyUserId(row.id);
    if (!key || !id) continue;
    map.set(key, id);
  }
  return map;
}

async function cleanupExpiredSubscriptions(supabase, rows) {
  if (!rows || rows.length === 0) return;
  const userIds = [...new Set(rows.map((row) => normalizeNotifyUserId(row.user_id)).filter(Boolean))];
  if (userIds.length === 0) return;
  await supabase.from(TABLES.PUSH_SUBSCRIPTIONS).delete().in('user_id', userIds);
  console.info('[send-push] subscriptions expiradas removidas', { users: userIds.length });
}

async function loadPermissionMapByUser(supabase, users) {
  const roleKeys = [...new Set(users.map((u) => String(u.role ?? '').trim().toLowerCase()).filter(Boolean))];
  if (roleKeys.length === 0) return new Map();

  const { data: roles, error: rolesError } = await supabase
    .from(TABLES.ROLES)
    .select('id, key')
    .in('key', roleKeys);

  if (rolesError || !roles || roles.length === 0) {
    console.warn('[send-push] falha ao buscar roles para permissões', rolesError?.message);
    return new Map();
  }

  const roleIdByKey = new Map(roles.map((r) => [String(r.key).trim().toLowerCase(), r.id]));
  const roleIds = [...new Set(roles.map((r) => r.id))];
  const { data: rolePerms } = await supabase
    .from(TABLES.ROLE_PERMISSIONS)
    .select('role_id, permission_key')
    .in('role_id', roleIds);

  const permsByRoleId = new Map();
  for (const row of rolePerms ?? []) {
    const roleId = row.role_id;
    const permission = String(row.permission_key ?? '').trim();
    if (!roleId || !permission) continue;
    const set = permsByRoleId.get(roleId) ?? new Set();
    set.add(permission);
    permsByRoleId.set(roleId, set);
  }

  const permissionsByUserId = new Map();
  for (const user of users) {
    const userId = normalizeNotifyUserId(user.id);
    if (!userId) continue;
    const roleKey = String(user.role ?? '').trim().toLowerCase();
    const roleId = roleIdByKey.get(roleKey);
    permissionsByUserId.set(userId, permsByRoleId.get(roleId) ?? new Set());
  }
  return permissionsByUserId;
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
  const webhookSecret = getOptionalEnv('PUSH_WEBHOOK_SECRET');

  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !supabaseKey) {
    console.error('[send-push] Configuração incompleta (VAPID ou Supabase)');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  if (webhookSecret) {
    const receivedSecret = getSecretFromRequest(req);
    if (receivedSecret !== webhookSecret) {
      console.warn('[send-push] webhook sem autenticação válida');
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }
  }

  const webpush = await import('web-push').then((m) => m.default ?? m);
  webpush.setVapidDetails('mailto:suporte@bismarchipires.com.br', vapidPublic, vapidPrivate);

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const type = (body.type || body.eventType || '').toUpperCase();
    const table = body.table || '';
    const record = body.record || body.new || body.payload?.record || body;
    console.log('[send-push] Webhook recebido:', { type, table, hasRecord: !!record?.ticket_id });

    const oldRecord = body.old_record || body.old || body.payload?.old_record || {};
    const isInsert = type === 'INSERT' || (!type && (Boolean(record?.id) || Boolean(record?.ticket_id)));
    const isUpdate = type === 'UPDATE';
    if (!isInsert && !isUpdate) {
      return res.status(200).json({ ok: true, message: 'Event ignored' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (
      isUpdate &&
      (table === 'app_c009c0e4f1_tickets' || table === 'tickets') &&
      Boolean(record.id)
    ) {
      const ticketId = record.id;
      const newAssignee = normalizeNotifyUserId(record.assigned_to);
      const oldAssignee = normalizeNotifyUserId(oldRecord.assigned_to);

      if (!shouldNotifyTicketAssigned(newAssignee, oldAssignee)) {
        return res.status(200).json({ sent: 0, message: 'No reassignment to notify' });
      }

      const { data: subs } = await supabase
        .from(TABLES.PUSH_SUBSCRIPTIONS)
        .select('subscription, user_id')
        .eq('user_id', newAssignee);

      if (!subs || subs.length === 0) return res.status(200).json({ sent: 0 });

      const title = record.title || `Ticket #${(ticketId || '').slice(0, 8)}`;
      const payload = {
        title: 'Ticket atribuído para você',
        body: title,
        url: `${appUrl}/tickets/${ticketId}`,
        tag: `ticket-assigned-${ticketId}`,
      };

      let sent = 0;
      const expiredSubs = [];
      const errors = [];
      for (const row of subs) {
        const sub = row.subscription;
        if (!sub || !sub.endpoint) continue;
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          sent++;
        } catch (e) {
          if (isExpiredSubscriptionError(e)) {
            expiredSubs.push(row);
          }
          errors.push({ userId: row.user_id, statusCode: e?.statusCode, message: e?.message });
          console.warn('[send-push] Erro ao enviar (atribuição de ticket):', e.message);
        }
      }
      await cleanupExpiredSubscriptions(supabase, expiredSubs);
      return res.status(200).json({ sent, errors });
    }

    if (!isInsert) {
      return res.status(200).json({ ok: true, message: 'Event ignored' });
    }

    if (
      (table === 'app_c009c0e4f1_chat_messages' || table === 'chat_messages') &&
      Boolean(record.ticket_id)
    ) {
      const ticketId = record.ticket_id;
      const senderUserId = record.user_id;
      const senderName = record.user_name || 'Alguém';
      const messagePreview = (record.message || '').slice(0, 80);

      const { data: ticket, error: ticketError } = await supabase
        .from(TABLES.TICKETS)
        .select('id, title, created_by, assigned_to')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        console.warn('[send-push] Ticket não encontrado:', ticketId);
        return res.status(200).json({ sent: 0 });
      }

      const ctx = {
        requester: normalizeNotifyUserId(ticket.created_by),
        assignee: normalizeNotifyUserId(ticket.assigned_to),
      };
      const userIds = getMessageRecipientUserIds(ctx, senderUserId);
      if (userIds.length === 0) return res.status(200).json({ sent: 0 });

      const { data: subs } = await supabase
        .from(TABLES.PUSH_SUBSCRIPTIONS)
        .select('subscription, user_id')
        .in('user_id', userIds);

      if (!subs || subs.length === 0) return res.status(200).json({ sent: 0 });

      const payload = {
        title: 'Nova mensagem',
        body: `${senderName}: ${messagePreview}${messagePreview.length >= 80 ? '…' : ''}`,
        url: `${appUrl}/tickets/${ticketId}`,
        tag: `msg-${ticketId}`,
      };

      let sent = 0;
      const expiredSubs = [];
      const errors = [];
      for (const row of subs) {
        const sub = row.subscription;
        if (!sub || !sub.endpoint) continue;
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          sent++;
        } catch (e) {
          if (isExpiredSubscriptionError(e)) {
            expiredSubs.push(row);
          }
          errors.push({ userId: row.user_id, statusCode: e?.statusCode, message: e?.message });
          console.warn('[send-push] Erro ao enviar para um subscription:', e.message);
        }
      }
      await cleanupExpiredSubscriptions(supabase, expiredSubs);
      return res.status(200).json({ sent, errors });
    }

    if (table === 'app_c009c0e4f1_tickets' && Boolean(record.id)) {
      const ticketId = record.id;
      const { data: ticket, error: ticketError } = await supabase
        .from(TABLES.TICKETS)
        .select('id, title, created_by, assigned_to, category')
        .eq('id', ticketId)
        .maybeSingle();

      if (ticketError || !ticket) {
        console.warn('[send-push] Ticket não encontrado no push de novo ticket', { ticketId });
        return res.status(200).json({ sent: 0 });
      }
      const title = ticket.title || `Ticket #${(ticketId || '').slice(0, 8)}`;

      const ctx = {
        requester: normalizeNotifyUserId(ticket.created_by),
        assignee: normalizeNotifyUserId(ticket.assigned_to),
        category: String(ticket.category ?? '').trim(),
        isUnassigned: !ticket.assigned_to,
      };

      const { data: subs } = await supabase
        .from(TABLES.PUSH_SUBSCRIPTIONS)
        .select('subscription, user_id')
        .not('user_id', 'is', null);

      if (!subs || subs.length === 0) return res.status(200).json({ sent: 0 });

      const subscribedUserIds = [...new Set(subs.map((row) => normalizeNotifyUserId(row.user_id)).filter(Boolean))];
      if (subscribedUserIds.length === 0) return res.status(200).json({ sent: 0 });

      const { data: users } = await supabase
        .from(TABLES.USERS)
        .select('id, role, tag_id, is_active')
        .in('id', subscribedUserIds)
        .eq('is_active', true);

      if (!users || users.length === 0) return res.status(200).json({ sent: 0 });

      const [categoriesResult, tagsResult, permissionsByUserId] = await Promise.all([
        supabase.from(TABLES.CATEGORIES).select('key, tag_id').not('tag_id', 'is', null),
        supabase.from(TABLES.TAGS).select('id, key'),
        loadPermissionMapByUser(supabase, users),
      ]);
      const categoryKeysByTagId = toCategoryKeysByTagId(categoriesResult.data ?? []);
      const tagIdByKey = toTagIdByKey(tagsResult.data ?? []);

      const userIds = getNewTicketRecipientUserIds(ctx, {
        senderUserId: ticket.created_by,
        users,
        permissionsByUserId,
        categoryKeysByTagId,
        tagIdByKey,
      });
      if (userIds.length === 0) {
        console.log('[send-push] Novo ticket sem destinatários elegíveis', { ticketId });
        return res.status(200).json({ sent: 0 });
      }

      const subsByUser = subs.filter((row) => userIds.includes(row.user_id));
      if (subsByUser.length === 0) return res.status(200).json({ sent: 0 });

      const payload = {
        title: 'Novo ticket',
        body: title,
        url: `${appUrl}/tickets/${ticketId}`,
        tag: `ticket-${ticketId}`,
      };

      let sent = 0;
      const expiredSubs = [];
      const errors = [];
      for (const row of subsByUser) {
        const sub = row.subscription;
        if (!sub || !sub.endpoint) continue;
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
          sent++;
        } catch (e) {
          if (isExpiredSubscriptionError(e)) {
            expiredSubs.push(row);
          }
          errors.push({ userId: row.user_id, statusCode: e?.statusCode, message: e?.message });
          console.warn('[send-push] Erro ao enviar:', e.message);
        }
      }
      await cleanupExpiredSubscriptions(supabase, expiredSubs);
      return res.status(200).json({ sent, errors });
    }

    return res.status(200).json({ ok: true, message: 'No action' });
  } catch (err) {
    console.error('[send-push]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
