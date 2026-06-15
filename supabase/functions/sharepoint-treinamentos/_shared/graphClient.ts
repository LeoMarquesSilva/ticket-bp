export type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  listId: string;
};

const SETTINGS_KEY = "sharepoint_graph_config";
let cachedConfig: GraphConfig | null = null;

function configFromEnv(): GraphConfig {
  return {
    tenantId: (Deno.env.get("MICROSOFT_TENANT_ID") ?? "").trim(),
    clientId: (Deno.env.get("MICROSOFT_CLIENT_ID") ?? "").trim(),
    clientSecret: (
      Deno.env.get("MICROSOFT_CLIENT_SECRET") ??
      Deno.env.get("MICROSOFT_SECRET_ID") ??
      ""
    ).trim(),
    siteId: (Deno.env.get("SHAREPOINT_SITE_ID") ?? "").trim(),
    listId: (Deno.env.get("SHAREPOINT_TREINAMENTOS_LIST_ID") ?? "").trim(),
  };
}

function isCompleteConfig(config: GraphConfig): boolean {
  return Boolean(
    config.tenantId &&
      config.clientId &&
      config.clientSecret &&
      config.siteId &&
      config.listId,
  );
}

export function getGraphConfig(): GraphConfig {
  if (cachedConfig) return cachedConfig;
  return configFromEnv();
}

export async function resolveGraphConfig(
  admin?: { from: (table: string) => unknown },
): Promise<GraphConfig> {
  if (cachedConfig) return cachedConfig;

  const fromEnv = configFromEnv();
  if (isCompleteConfig(fromEnv)) {
    cachedConfig = fromEnv;
    return fromEnv;
  }

  if (admin) {
    const { data } = await (admin as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: { value?: string } | null }>;
          };
        };
      };
    })
      .from("app_c009c0e4f1_integration_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    const raw = data?.value?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<GraphConfig>;
        const fromDb: GraphConfig = {
          tenantId: String(parsed.tenantId ?? "").trim(),
          clientId: String(parsed.clientId ?? "").trim(),
          clientSecret: String(parsed.clientSecret ?? "").trim(),
          siteId: String(parsed.siteId ?? "").trim(),
          listId: String(parsed.listId ?? "").trim(),
        };
        if (isCompleteConfig(fromDb)) {
          cachedConfig = fromDb;
          return fromDb;
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }

  return fromEnv;
}

export function assertGraphConfig(config = getGraphConfig()): string | null {
  const { tenantId, clientId, clientSecret, siteId, listId } = config;
  if (!tenantId) return "MICROSOFT_TENANT_ID ausente";
  if (!clientId) return "MICROSOFT_CLIENT_ID ausente";
  if (!clientSecret) return "MICROSOFT_CLIENT_SECRET ausente";
  if (!siteId) return "SHAREPOINT_SITE_ID ausente";
  if (!listId) return "SHAREPOINT_TREINAMENTOS_LIST_ID ausente";
  return null;
}

export async function getGraphAccessToken(config?: GraphConfig): Promise<string> {
  const { tenantId, clientId, clientSecret } = config ?? getGraphConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error_description ?? json.error ?? res.statusText;
    throw new Error(`Falha ao obter token Microsoft Graph: ${msg}`);
  }
  if (!json.access_token) {
    throw new Error("Token Microsoft Graph não retornado");
  }
  return String(json.access_token);
}

export async function graphFetch(
  path: string,
  init: RequestInit & { token?: string; config?: GraphConfig } = {},
): Promise<Response> {
  const token = init.token ?? await getGraphAccessToken(init.config);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers,
  });
}
