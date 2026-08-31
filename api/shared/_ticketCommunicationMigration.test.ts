import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260824150304_ticket_communications.sql'),
  'utf8',
);
const delegatedTeamsMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260828184213_ticket_communications_delegated_teams.sql'),
  'utf8',
);
const queuePreviewMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260828214500_ticket_communication_queue_preview.sql'),
  'utf8',
);
const deliveryRequesterMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831132000_ticket_communication_delivery_requester.sql'),
  'utf8',
);
const retryDeliveryMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260831140000_ticket_communication_retry_delivery.sql'),
  'utf8',
);

describe('ticket communications migration contract', () => {
  it('fences completion with the active claim token, attempt and processing state', () => {
    expect(migration).toMatch(/claim_token uuid/);
    expect(migration).toMatch(/claim_token\s*=\s*pg_catalog\.gen_random_uuid\(\)/);
    expect(migration).toMatch(
      /helpdesk_complete_ticket_notification\(\s*p_delivery_id uuid,\s*p_claim_token uuid,\s*p_attempt_count integer,/,
    );
    expect(migration).toMatch(/delivery\.status = 'processing'/);
    expect(migration).toMatch(/delivery\.claim_token = p_claim_token/);
    expect(migration).toMatch(/delivery\.attempt_count = p_attempt_count/);
    expect(migration).toMatch(/if not found then\s+return null;\s+end if;/);
  });

  it('cancels stale resolved-invite cycles and only claims the current resolved_at cycle', () => {
    expect(migration).toMatch(/cancellation_reason = 'stale_cycle'/);
    expect(migration).toMatch(/delivery\.cycle_key <> \(pg_catalog\.to_jsonb\(ticket\.resolved_at\) #>> '\{\}'\)/);
    expect(migration).toMatch(/delivery\.cycle_key = \(pg_catalog\.to_jsonb\(ticket\.resolved_at\) #>> '\{\}'\)/);
    expect(migration).not.toMatch(/ticket\.resolved_at::text/);
  });

  it('backfills the legacy automatic finalization prompt as a system message', () => {
    expect(migration).toMatch(/update public\.app_c009c0e4f1_chat_messages/);
    expect(migration).toMatch(/set is_system = true/);
    expect(migration).toMatch(/message like '✅ Seu atendimento%foi finalizado!%Avaliar Agora%'/);
  });

  it('exposes a fenced release operation for claims deferred by the execution budget', () => {
    expect(migration).toMatch(/create function public\.helpdesk_release_ticket_notification/);
    expect(migration).toMatch(/delivery\.claim_token = p_claim_token/);
    expect(migration).toMatch(/delivery\.attempt_count = p_attempt_count/);
    expect(migration).toMatch(/status = 'pending'/);
  });

  it('exposes a service-only ready backlog counter', () => {
    expect(migration).toMatch(/create function public\.helpdesk_count_ready_ticket_notifications/);
    expect(migration).toMatch(
      /grant execute\s+on function public\.helpdesk_count_ready_ticket_notifications\(timestamptz, uuid, text\)\s+to service_role/,
    );
  });

  it('finishes through one conditional database transition that reports its winner', () => {
    expect(migration).toMatch(/create function public\.helpdesk_finish_ticket/);
    expect(migration).toMatch(/where ticket\.id = p_ticket_id\s+and ticket\.status <> 'resolved'/);
    expect(migration).toMatch(/'changed', true/);
    expect(migration).toMatch(/'changed', false/);
  });
});

describe('delegated Teams credential migration contract', () => {
  it('mantém um único token criptografado e nenhuma política para usuários do app', () => {
    expect(delegatedTeamsMigration).toMatch(
      /create table public\.app_c009c0e4f1_ticket_teams_oauth/,
    );
    expect(delegatedTeamsMigration).toMatch(/singleton boolean primary key/);
    expect(delegatedTeamsMigration).toMatch(/refresh_token_ciphertext text not null/);
    expect(delegatedTeamsMigration).toMatch(/refresh_token_iv text not null/);
    expect(delegatedTeamsMigration).toMatch(/enable row level security/);
    expect(delegatedTeamsMigration).toMatch(/revoke all[\s\S]+from anon, authenticated/);
    expect(delegatedTeamsMigration).not.toMatch(/create policy/i);
  });
});

describe('ticket communication queue preview migration contract', () => {
  it('expõe a lista de entregas somente para service_role', () => {
    expect(queuePreviewMigration).toMatch(/create function public\.helpdesk_list_ticket_communication_deliveries/);
    expect(queuePreviewMigration).toMatch(/grant execute\s+on function public\.helpdesk_list_ticket_communication_deliveries\(integer\)\s+to service_role/);
    expect(queuePreviewMigration).toMatch(/revoke all[\s\S]+from public, anon, authenticated, service_role/);
    expect(queuePreviewMigration).not.toMatch(/grant execute[\s\S]+to authenticated/);
  });

  it('inclui o solicitante na lista de entregas só para service_role', () => {
    expect(deliveryRequesterMigration).toMatch(/requester_id uuid/);
    expect(deliveryRequesterMigration).toMatch(/on requester\.id = ticket\.created_by/);
    expect(deliveryRequesterMigration).toMatch(/grant execute\s+on function public\.helpdesk_list_ticket_communication_deliveries\(integer\)\s+to service_role/);
    expect(deliveryRequesterMigration).toMatch(/revoke all[\s\S]+from public, anon, authenticated, service_role/);
    expect(deliveryRequesterMigration).not.toMatch(/grant execute[\s\S]+to authenticated/);
  });
});

describe('ticket communication retry delivery migration contract', () => {
  it('recoloca um aviso falho só para service_role', () => {
    expect(retryDeliveryMigration).toMatch(/create function public\.helpdesk_requeue_ticket_notification/);
    expect(retryDeliveryMigration).toMatch(/grant execute\s+on function public\.helpdesk_requeue_ticket_notification\(/);
    expect(retryDeliveryMigration).toMatch(/to service_role/);
    expect(retryDeliveryMigration).toMatch(/revoke all[\s\S]+from public, anon, authenticated, service_role/);
    expect(retryDeliveryMigration).not.toMatch(/grant execute[\s\S]+to authenticated/);
  });
});
