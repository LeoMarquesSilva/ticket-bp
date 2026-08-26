export type GraphConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  treinamentosListId: string;
  presencaListId: string;
};

export function getGraphConfig(): GraphConfig {
  return {
    tenantId: (Deno.env.get("MICROSOFT_TENANT_ID") ?? "").trim(),
    clientId: (Deno.env.get("MICROSOFT_CLIENT_ID") ?? "").trim(),
    clientSecret: (
      Deno.env.get("MICROSOFT_CLIENT_SECRET") ??
      Deno.env.get("MICROSOFT_SECRET_ID") ??
      ""
    ).trim(),
    siteId: (Deno.env.get("SHAREPOINT_SITE_ID") ?? "").trim(),
    treinamentosListId: (Deno.env.get("SHAREPOINT_TREINAMENTOS_LIST_ID") ?? "").trim(),
    presencaListId: (
      Deno.env.get("SHAREPOINT_PRESENCA_LIST_ID") ??
      "30ea2880-475e-489c-8600-ae541d29faf3"
    ).trim(),
  };
}

export function assertGraphConfig(config = getGraphConfig()): string | null {
  if (!config.tenantId) return "MICROSOFT_TENANT_ID ausente";
  if (!config.clientId) return "MICROSOFT_CLIENT_ID ausente";
  if (!config.clientSecret) return "MICROSOFT_CLIENT_SECRET ausente";
  if (!config.siteId) return "SHAREPOINT_SITE_ID ausente";
  if (!config.treinamentosListId) return "SHAREPOINT_TREINAMENTOS_LIST_ID ausente";
  if (!config.presencaListId) return "SHAREPOINT_PRESENCA_LIST_ID ausente";
  return null;
}

export async function getGraphAccessToken(config = getGraphConfig()): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Falha ao obter token Microsoft Graph: ${json.error_description ?? json.error ?? res.statusText}`,
    );
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
  return fetch(`https://graph.microsoft.com/v1.0${path}`, { ...init, headers });
}

export async function listAllItems(
  siteId: string,
  listId: string,
  token: string,
): Promise<Array<{ id: string; fields: Record<string, unknown>; createdBy?: { user?: { displayName?: string; email?: string } } }>> {
  const items: Array<{
    id: string;
    fields: Record<string, unknown>;
    createdBy?: { user?: { displayName?: string; email?: string } };
  }> = [];
  let url: string | null =
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`;

  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Graph ${res.status} ao listar ${listId}`);
    }
    items.push(...(json.value ?? []));
    url = json["@odata.nextLink"] ?? null;
  }
  return items;
}
