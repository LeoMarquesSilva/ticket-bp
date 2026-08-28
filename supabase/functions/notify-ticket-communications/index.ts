import { withSupabase } from 'npm:@supabase/server@1.4.1';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createCorsHeaders } from './_shared/cors.ts';
import { createGraphClient } from './_shared/graphClient.mjs';
import { createTicketCommunicationRepository } from './_shared/repository.ts';
import { handleTicketCommunicationRequest } from './_shared/requestHandler.mjs';
import { readTicketCommunicationRuntimeConfig } from './_shared/runtimeConfig.mjs';
import { createTeamsChatClient } from './_shared/teamsChatClient.mjs';
import { createTeamsDelegatedStore } from './_shared/teamsDelegatedStore.ts';
import {
  handleTeamsOAuthAction,
  handleTeamsOAuthCallback,
  TEAMS_OAUTH_ACTIONS,
} from './_shared/teamsOAuthHandler.mjs';

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
  });
  return graphClient;
}

function getTeamsClient(config: RuntimeConfig, supabaseAdmin: unknown) {
  return createTeamsChatClient({
    config,
    store: createTeamsDelegatedStore(supabaseAdmin),
    fetchImpl: globalThis.fetch,
    cryptoImpl: globalThis.crypto,
  });
}

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

const authenticatedFetch = withSupabase(
  {
    auth: ['user', 'secret:ticket-communications'],
    cors: {
      headers: createCorsHeaders(Deno.env.get('APP_PUBLIC_URL')),
    },
  },
  async (req, ctx) => {
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const body = await req.json().catch(() => null);
    if (body && typeof body === 'object' && TEAMS_OAUTH_ACTIONS.has(body.action)) {
      const config = readRuntimeConfig();
      if (!config) return json(503, { error: 'service_unavailable' });
      const { data: isAdmin, error: permissionError } = await ctx.supabase
        .rpc('helpdesk_has_manage_categories');
      if (permissionError) return json(500, { error: 'internal_error' });
      const result = await handleTeamsOAuthAction({
        authMode: ctx.authMode,
        body,
        isAdmin: isAdmin === true,
        config,
        teamsClient: getTeamsClient(config, ctx.supabaseAdmin),
      });
      return json(result.status, result.body);
    }

    const result = await handleTicketCommunicationRequest({
      authMode: ctx.authMode,
      body,
      dependencies: {
        supabase: ctx.supabase,
        clock: () => new Date(),
        createRuntimeDependencies: () => {
          const config = readRuntimeConfig();
          if (!config) return null;
          const appGraph = getGraphClient(config);
          const teamsClient = getTeamsClient(config, ctx.supabaseAdmin);
          return {
            repository: createTicketCommunicationRepository(ctx.supabaseAdmin),
            graph: {
              sendEmail: appGraph.sendEmail,
              resolveUserId: appGraph.resolveUserId,
              sendTeamsChat: teamsClient.sendChat,
            },
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

async function oauthCallback(req: Request): Promise<Response> {
  const config = readRuntimeConfig();
  if (!config) return json(503, { error: 'service_unavailable' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceRoleKey) return json(503, { error: 'service_unavailable' });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await handleTeamsOAuthCallback({
    url: new URL(req.url),
    config,
    teamsClient: getTeamsClient(config, supabaseAdmin),
  });
  if ('location' in result) {
    return new Response(null, {
      status: result.status,
      headers: { Location: result.location, 'Cache-Control': 'no-store' },
    });
  }
  return json(result.status, result.body);
}

async function fetch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (
    req.method === 'GET'
    && url.pathname.endsWith('/notify-ticket-communications/oauth/callback')
  ) {
    return oauthCallback(req);
  }
  return authenticatedFetch(req);
}

export default { fetch };
