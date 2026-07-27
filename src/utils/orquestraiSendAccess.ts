/** Usuários MKT do Responsum autorizados a enviar tickets DC para o ORQESTRAI. */
export const ORQESTRAI_SENDER_EMAILS = [
  'leonardo.marques@bismarchipires.com.br',
  'valentina.iacovacci@bismarchipires.com.br',
] as const;

export const ORQESTRAI_SENDER_USER_IDS = [
  '7a46ad55-0945-49e0-9239-984ed82f0b34', // Leonardo Marques Silva
  'a977a9cd-368f-4134-a489-74e8050b95f2', // Valentina Iacovacci
] as const;

export function canSendToOrquestrai(user: {
  id?: string | null;
  email?: string | null;
} | null | undefined): boolean {
  if (!user) return false;
  const email = String(user.email ?? '').trim().toLowerCase();
  if (email && (ORQESTRAI_SENDER_EMAILS as readonly string[]).includes(email)) {
    return true;
  }
  const id = String(user.id ?? '').trim();
  return Boolean(id && (ORQESTRAI_SENDER_USER_IDS as readonly string[]).includes(id));
}
