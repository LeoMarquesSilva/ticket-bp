import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260824150304_ticket_communications.sql'),
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
    expect(migration).toMatch(/delivery\.cycle_key <> ticket\.resolved_at::text/);
    expect(migration).toMatch(/delivery\.cycle_key = ticket\.resolved_at::text/);
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
