import { createClient } from 'npm:@supabase/supabase-js@2';
import { createCorsHeaders } from './_shared/cors.ts';
import { createGraphClient } from './_shared/graphClient.mjs';
import { createTicketCommunicationRepository } from './_shared/repository.ts';
import {
  readNamedSecret,
  resolveTicketCommunicationAuth,
} from './_shared/requestAuth.mjs';
import { handleTicketCommunicationRequest } from './_shared/requestHandler.mjs';
import { readTicketCommunicationRuntimeConfig } from './_shared/runtimeConfig.mjs';
import { createTeamsChatClient } from './_shared/teamsChatClient.mjs';
import { createTeamsDelegatedStore } from './_shared/teamsDelegatedStore.ts';
import {
  handleTeamsOAuthAction,
  handleTeamsOAuthCallback,
  handleTeamsTestSend,
  TEAMS_OAUTH_ACTIONS,
  TEAMS_TEST_ACTION,
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

const TEAMS_HEADER_ORANGE_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAQAAAAAgCAIAAAByyzGzAAACd0lEQVR4nO3T6VpMcRwH8G5DNc2mMXPOzDlzRrJkKYwsiexbQqRIlKVki0SJkAhZrkSRJIQKIWH2aabZmpbXnt//nLkFr77P87mFT9LM81kzz8j002TyhOlInu5ImXqcMvWIeUgm21PJA+Z+6mSbKt6mit9jWlXx1rSJu2kTd5jbTIs61qKO3WJuqmPNmmizJnqDadJEm7TRRm2kURu5ro1cYxp04QZd+CpTrwvX68NX9KHLTJ0+VDc7dImMX2QupI+fJ8FzTG16sNYQPGsI1hgCNYZAtSFQPSdwhoydZk4Zx04yVUZ/ldFfafRXmvwniO+4yVdh8lVwvmNMOect57xHeXKE95bxnjLeU8p7Ss2ew0yJ2V1idh+yuA8yxRZXscV1QCD7Bdc+4iwSnEWicy9TKDoKRcceq2M3s4v83SmRHcx26c82G9mq+L0lYbNtlEijm6RfsgIyUiCNbFT83JCQL/3It5L11u+yPDKcZx1ep/i2ViZ+XZOwWvwiyyVDueLQKjIoswuDdmHALgysVHxekbBc+CTLET7mWEg26c+29C9TfFiqeL8kYbH5nSyL9GWZ+xYp3i5U9C6Q8b3z+TeyTNKTyffMI69lGaQ7g+ueq3hlS5C4lzIr1yUTuS7R1CmaOgXFCwtJQgAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAEQAAE+D8B/gFRMYwVZHWA/AAAAABJRU5ErkJggg=='),
  (char) => char.charCodeAt(0),
);

function corsHeaders(req?: Request): Record<string, string> {
  return createCorsHeaders(Deno.env.get('APP_PUBLIC_URL'), req?.headers.get('Origin'));
}

function teamsHeaderImageUrl(): string | undefined {
  const root = String(Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');
  return root ? `${root}/functions/v1/notify-ticket-communications/teams-header-orange.png` : undefined;
}

function json(status: number, body: unknown, req?: Request): Response {
  return Response.json(body, {
    status,
    headers: { ...corsHeaders(req), 'Cache-Control': 'no-store' },
  });
}

function createUserClient(authorization: string) {
  return createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function authenticatedFetch(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, req);

  const authorization = req.headers.get('Authorization');
  const auth = await resolveTicketCommunicationAuth({
    authorization,
    apikey: req.headers.get('apikey'),
    namedSecret: readNamedSecret(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '', 'ticket-communications'),
    getUser: async (token: string) => {
      try {
        const { data } = await createUserClient(`Bearer ${token}`).auth.getUser(token);
        return data.user ?? null;
      } catch {
        return null;
      }
    },
  });
  if (!auth) return json(401, { error: 'unauthorized' }, req);

  const supabaseAdmin = createAdminClient();
  const supabase = auth.authMode === 'user' && authorization
    ? createUserClient(authorization)
    : supabaseAdmin;

  const body = await req.json().catch(() => null);
  if (
    body
    && typeof body === 'object'
    && (TEAMS_OAUTH_ACTIONS.has(body.action) || body.action === TEAMS_TEST_ACTION)
  ) {
    const config = readRuntimeConfig();
    if (!config) return json(503, { error: 'service_unavailable' }, req);
    const { data: isAdmin, error: permissionError } = await supabase
      .rpc('helpdesk_has_manage_categories');
    if (permissionError) return json(500, { error: 'internal_error' }, req);
    const teamsClient = getTeamsClient(config, supabaseAdmin);
    if (body.action === TEAMS_TEST_ACTION) {
      const repository = createTicketCommunicationRepository(supabaseAdmin);
      let teamsTemplateOverrides = {};
      try {
        teamsTemplateOverrides = await repository.getTeamsTemplateOverrides();
      } catch {
        teamsTemplateOverrides = {};
      }
      const result = await handleTeamsTestSend({
        authMode: auth.authMode,
        isAdmin: isAdmin === true,
        email: body.email,
        name: body.name,
        type: body.type,
        appPublicUrl: config.appPublicUrl,
        headerImageUrl: teamsHeaderImageUrl(),
        resolveUserId: getGraphClient(config).resolveUserId,
        lookupName: async (recipientEmail: string) => {
          const { data } = await supabaseAdmin
            .from('app_c009c0e4f1_users')
            .select('name')
            .ilike('email', recipientEmail)
            .maybeSingle();
          return typeof data?.name === 'string' ? data.name : '';
        },
        sendChat: teamsClient.sendChat,
        teamsTemplateOverrides,
      });
      return json(result.status, result.body, req);
    }
    const result = await handleTeamsOAuthAction({
      authMode: auth.authMode,
      body,
      isAdmin: isAdmin === true,
      config,
      teamsClient,
    });
    return json(result.status, result.body, req);
  }

  let isAdmin = false;
  if (
    auth.authMode === 'user'
    && body
    && typeof body === 'object'
    && (body.action === 'queue_status' || body.action === 'run_pending' || body.action === 'retry_delivery')
  ) {
    const { data: adminFlag, error: permissionError } = await supabase
      .rpc('helpdesk_has_manage_categories');
    if (permissionError) return json(500, { error: 'internal_error' }, req);
    isAdmin = adminFlag === true;
  }

  const result = await handleTicketCommunicationRequest({
    authMode: auth.authMode,
    isAdmin,
    body,
    dependencies: {
      supabase,
      clock: () => new Date(),
      createRuntimeDependencies: () => {
        const config = readRuntimeConfig();
        if (!config) return null;
        const appGraph = getGraphClient(config);
        const teamsClient = getTeamsClient(config, supabaseAdmin);
        return {
          repository: createTicketCommunicationRepository(supabaseAdmin),
          graph: {
            sendEmail: appGraph.sendEmail,
            resolveUserId: appGraph.resolveUserId,
            sendTeamsChat: teamsClient.sendChat,
          },
          appBaseUrl: config.appPublicUrl,
          headerImageUrl: teamsHeaderImageUrl(),
        };
      },
    },
  });

  if ('budgetExhausted' in result.body && result.body.budgetExhausted === true) {
    console.info('[ticket-communications] processing budget exhausted', {
      backlog: 'backlog' in result.body ? result.body.backlog : 0,
    });
  }

  return json(result.status, result.body, req);
}

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
  if (req.method === 'GET' && url.pathname.endsWith('/teams-header-orange.png')) {
    return new Response(TEAMS_HEADER_ORANGE_PNG, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }
  if (
    req.method === 'GET'
    && url.pathname.endsWith('/notify-ticket-communications/oauth/callback')
  ) {
    return oauthCallback(req);
  }
  return authenticatedFetch(req);
}

export default { fetch };
