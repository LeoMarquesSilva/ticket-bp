import { describe, expect, it, vi } from 'vitest';
import {
  createTeamsDelegatedStore,
} from '../../supabase/functions/notify-ticket-communications/_shared/teamsDelegatedStore.ts';

const ROW = {
  singleton: true,
  account_id: '11111111-1111-1111-1111-111111111111',
  account_email: 'leonardo.marques@bismarchipires.com.br',
  account_display_name: 'Leonardo Marques',
  refresh_token_ciphertext: 'ciphertext',
  refresh_token_iv: 'iv',
  connected_at: '2026-08-28T18:00:00.000Z',
  updated_at: '2026-08-28T18:00:00.000Z',
};

function fakeClient() {
  const maybeSingle = vi.fn(async () => ({ data: ROW, error: null }));
  const selectEq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const single = vi.fn(async () => ({ data: ROW, error: null }));
  const upsertSelect = vi.fn(() => ({ single }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));
  const deleteEq = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(() => ({ eq: deleteEq }));
  const table = { select, upsert, delete: remove };
  const from = vi.fn(() => table);
  return { client: { from }, from, select, selectEq, maybeSingle, upsert, upsertSelect, single, remove, deleteEq };
}

describe('createTeamsDelegatedStore', () => {
  it('lê e mapeia a credencial completa somente para uso interno', async () => {
    const fake = fakeClient();
    const store = createTeamsDelegatedStore(fake.client);

    await expect(store.get()).resolves.toEqual({
      accountId: ROW.account_id,
      accountEmail: ROW.account_email,
      accountDisplayName: ROW.account_display_name,
      encryptedRefreshToken: { ciphertext: ROW.refresh_token_ciphertext, iv: ROW.refresh_token_iv },
      connectedAt: ROW.connected_at,
      updatedAt: ROW.updated_at,
    });
    expect(fake.from).toHaveBeenCalledWith('app_c009c0e4f1_ticket_teams_oauth');
    expect(fake.selectEq).toHaveBeenCalledWith('singleton', true);
  });

  it('salva somente o envelope cifrado e os dados públicos da conta', async () => {
    const fake = fakeClient();
    const store = createTeamsDelegatedStore(fake.client);

    await store.save({
      accountId: ROW.account_id,
      accountEmail: ROW.account_email,
      accountDisplayName: ROW.account_display_name,
      encryptedRefreshToken: { ciphertext: 'new-ciphertext', iv: 'new-iv' },
      connectedAt: ROW.connected_at,
    });

    expect(fake.upsert).toHaveBeenCalledWith({
      singleton: true,
      account_id: ROW.account_id,
      account_email: ROW.account_email,
      account_display_name: ROW.account_display_name,
      refresh_token_ciphertext: 'new-ciphertext',
      refresh_token_iv: 'new-iv',
      connected_at: ROW.connected_at,
    }, { onConflict: 'singleton' });
    expect(JSON.stringify(fake.upsert.mock.calls)).not.toContain('refresh-token-secret');
  });

  it('remove a única conexão sem aceitar um identificador do cliente', async () => {
    const fake = fakeClient();
    const store = createTeamsDelegatedStore(fake.client);

    await store.disconnect();

    expect(fake.remove).toHaveBeenCalledOnce();
    expect(fake.deleteEq).toHaveBeenCalledWith('singleton', true);
  });
});
