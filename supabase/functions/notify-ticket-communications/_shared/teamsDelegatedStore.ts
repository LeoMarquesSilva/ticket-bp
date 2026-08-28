const TABLE = 'app_c009c0e4f1_ticket_teams_oauth';
const FIELDS = [
  'account_id',
  'account_email',
  'account_display_name',
  'refresh_token_ciphertext',
  'refresh_token_iv',
  'connected_at',
  'updated_at',
].join(', ');

type Row = {
  account_id: string;
  account_email: string;
  account_display_name: string | null;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  connected_at: string;
  updated_at: string;
};

export type TeamsDelegatedCredential = {
  accountId: string;
  accountEmail: string;
  accountDisplayName: string | null;
  encryptedRefreshToken: { ciphertext: string; iv: string };
  connectedAt: string;
  updatedAt: string;
};

function mapRow(row: Row | null): TeamsDelegatedCredential | null {
  if (!row) return null;
  return {
    accountId: row.account_id,
    accountEmail: row.account_email,
    accountDisplayName: row.account_display_name,
    encryptedRefreshToken: {
      ciphertext: row.refresh_token_ciphertext,
      iv: row.refresh_token_iv,
    },
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
  };
}

function assertClient(client: unknown): asserts client is { from: (table: string) => any } {
  if (!client || typeof (client as { from?: unknown }).from !== 'function') {
    throw new TypeError('Supabase admin client is required');
  }
}

export function createTeamsDelegatedStore(supabaseAdmin: unknown) {
  assertClient(supabaseAdmin);

  return {
    async get(): Promise<TeamsDelegatedCredential | null> {
      const { data, error } = await supabaseAdmin
        .from(TABLE)
        .select(FIELDS)
        .eq('singleton', true)
        .maybeSingle();
      if (error) throw new Error('Teams delegated credential store failed: get');
      return mapRow(data as Row | null);
    },

    async save(input: Omit<TeamsDelegatedCredential, 'updatedAt'>): Promise<TeamsDelegatedCredential> {
      const { data, error } = await supabaseAdmin
        .from(TABLE)
        .upsert({
          singleton: true,
          account_id: input.accountId,
          account_email: input.accountEmail,
          account_display_name: input.accountDisplayName,
          refresh_token_ciphertext: input.encryptedRefreshToken.ciphertext,
          refresh_token_iv: input.encryptedRefreshToken.iv,
          connected_at: input.connectedAt,
        }, { onConflict: 'singleton' })
        .select(FIELDS)
        .single();
      if (error || !data) throw new Error('Teams delegated credential store failed: save');
      return mapRow(data as Row)!;
    },

    async disconnect(): Promise<void> {
      const { error } = await supabaseAdmin
        .from(TABLE)
        .delete()
        .eq('singleton', true);
      if (error) throw new Error('Teams delegated credential store failed: disconnect');
    },
  };
}
