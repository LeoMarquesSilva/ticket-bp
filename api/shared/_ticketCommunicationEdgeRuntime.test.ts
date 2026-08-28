import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('notify-ticket-communications Edge runtime imports', () => {
  it('usa uma versão de supabase-js compatível com @supabase/server', () => {
    const source = readFileSync(
      new URL('../../supabase/functions/notify-ticket-communications/index.ts', import.meta.url),
      'utf8',
    );

    expect(source).toContain("from 'npm:@supabase/supabase-js@2'");
    expect(source).toContain('resolveTicketCommunicationAuth');
    expect(source).toContain('teams-header-orange.png');
    expect(source).not.toContain('withSupabase');
    expect(source).not.toContain("from 'npm:@supabase/supabase-js@2.49.1'");
  });
});
