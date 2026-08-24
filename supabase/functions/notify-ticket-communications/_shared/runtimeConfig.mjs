import { normalizeAppPublicUrl } from './templates.mjs';

const ENV = Object.freeze({
  tenantId: 'TICKET_COMMUNICATIONS_MICROSOFT_TENANT_ID',
  clientId: 'TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_ID',
  clientSecret: 'TICKET_COMMUNICATIONS_MICROSOFT_CLIENT_SECRET',
  sender: 'TICKET_COMMUNICATIONS_MICROSOFT_NOTIFICATION_SENDER',
  teamsAppId: 'TICKET_COMMUNICATIONS_MICROSOFT_TEAMS_APP_ID',
  appPublicUrl: 'APP_PUBLIC_URL',
});

export function readTicketCommunicationRuntimeConfig(getEnv) {
  const values = Object.fromEntries(Object.entries(ENV).map(([key, name]) => [
    key,
    String(getEnv(name) ?? '').trim(),
  ]));
  if (Object.values(values).some((value) => !value)) return null;

  try {
    values.appPublicUrl = normalizeAppPublicUrl(values.appPublicUrl);
  } catch {
    return null;
  }
  return values;
}
