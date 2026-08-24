import { withSupabase } from 'npm:@supabase/server@1.4.1';
import { createCorsHeaders } from './_shared/cors.ts';
import { createGraphClient } from './_shared/graphClient.mjs';
import { createTicketCommunicationRepository } from './_shared/repository.ts';
import { handleTicketCommunicationRequest } from './_shared/requestHandler.mjs';
import { readTicketCommunicationRuntimeConfig } from './_shared/runtimeConfig.mjs';

type RuntimeConfig = NonNullable<ReturnType<typeof readTicketCommunicationRuntimeConfig>>;

let graphClient: ReturnType<typeof createGraphClient> | null = null;

function readRuntimeConfig(): RuntimeConfig | null {
  return readTicketCommunicationRuntimeConfig((name: string) => Deno.env.get(name));
}

function getGraphClient(config: RuntimeConfig) {
  graphClient ??= createGraphClient({
    tenantId: config.tenantId,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    sender: config.sender,
    teamsAppId: config.teamsAppId,
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
      headers: createCorsHeaders(Deno.env.get('APP_PUBLIC_URL')),
    },
  },
  async (req, ctx) => {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const body = await req.json().catch(() => null);
    const result = await handleTicketCommunicationRequest({
      authMode: ctx.authMode,
      body,
      dependencies: {
        supabase: ctx.supabase,
        clock: () => new Date(),
        createRuntimeDependencies: () => {
          const config = readRuntimeConfig();
          if (!config) return null;
          return {
            repository: createTicketCommunicationRepository(ctx.supabaseAdmin),
            graph: getGraphClient(config),
            appBaseUrl: config.appPublicUrl,
          };
        },
      },
    });

    if ('budgetExhausted' in result.body && result.body.budgetExhausted === true) {
      console.info('[ticket-communications] processing budget exhausted', {
        backlog: 'backlog' in result.body ? result.body.backlog : 0,
      });
    }

    return json(result.status, result.body);
  },
);

export default { fetch };
