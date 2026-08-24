import { withSupabase } from 'npm:@supabase/server@1.4.1';
import { createCorsHeaders } from './_shared/cors.ts';
import { createGraphClient } from './_shared/graphClient.mjs';
import { createTicketCommunicationRepository } from './_shared/repository.ts';
import { handleTicketCommunicationRequest } from './_shared/requestHandler.mjs';

const REQUIRED_SECRETS = [
  'MICROSOFT_TENANT_ID',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_NOTIFICATION_SENDER',
  'MICROSOFT_TEAMS_APP_ID',
  'HELPDESK_APP_BASE_URL',
] as const;

type RequiredSecret = typeof REQUIRED_SECRETS[number];
type RuntimeConfig = Record<RequiredSecret, string>;

let graphClient: ReturnType<typeof createGraphClient> | null = null;

function readRuntimeConfig(): RuntimeConfig | null {
  const entries = REQUIRED_SECRETS.map((name) => [name, Deno.env.get(name)?.trim() ?? ''] as const);
  if (entries.some(([, value]) => !value)) return null;

  const config = Object.fromEntries(entries) as RuntimeConfig;
  try {
    const appUrl = new URL(config.HELPDESK_APP_BASE_URL);
    if (appUrl.protocol !== 'https:' && appUrl.protocol !== 'http:') return null;
  } catch {
    return null;
  }
  return config;
}

function getGraphClient(config: RuntimeConfig) {
  graphClient ??= createGraphClient({
    tenantId: config.MICROSOFT_TENANT_ID,
    clientId: config.MICROSOFT_CLIENT_ID,
    clientSecret: config.MICROSOFT_CLIENT_SECRET,
    sender: config.MICROSOFT_NOTIFICATION_SENDER,
    teamsAppId: config.MICROSOFT_TEAMS_APP_ID,
  });
  return graphClient;
}

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

const fetch = withSupabase(
  {
    auth: ['user', 'secret:ticket-communications'],
    cors: {
      headers: createCorsHeaders(Deno.env.get('HELPDESK_APP_BASE_URL')),
    },
  },
  async (req, ctx) => {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const body = await req.json().catch(() => null);
    const config = readRuntimeConfig();
    if (!config) return json(503, { error: 'service_unavailable' });

    const result = await handleTicketCommunicationRequest({
      authMode: ctx.authMode,
      body,
      dependencies: {
        supabase: ctx.supabase,
        repository: createTicketCommunicationRepository(ctx.supabaseAdmin),
        graph: getGraphClient(config),
        appBaseUrl: config.HELPDESK_APP_BASE_URL,
        now: new Date(),
      },
    });

    return json(result.status, result.body);
  },
);

export default { fetch };
