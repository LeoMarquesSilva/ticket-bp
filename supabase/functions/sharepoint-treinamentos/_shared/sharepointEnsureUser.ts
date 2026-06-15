import { getGraphAccessToken, graphFetch, resolveGraphConfig } from "./graphClient.ts";

/** Resolve SharePoint LookupId via webhook n8n (ensureUser delegado) ou REST direto. */
export async function ensureSharepointUserLookupId(
  email: string,
  admin?: { from: (table: string) => unknown },
): Promise<string | null> {
  const webhook = (Deno.env.get("SHAREPOINT_ENSURE_USER_WEBHOOK_URL") ?? "").trim();
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.lookupId) return String(json.lookupId);
    } catch {
      // tenta REST abaixo
    }
  }

  const graphConfig = await resolveGraphConfig(admin);
  const siteRes = await graphFetch(`/sites/${graphConfig.siteId}?$select=webUrl`, {
    config: graphConfig,
  });
  const siteJson = await siteRes.json().catch(() => ({}));
  const webUrl = String(siteJson.webUrl ?? "").replace(/\/$/, "");
  if (!webUrl) return null;

  const variants = [email.trim().toLowerCase()];
  if (variants[0].endsWith("@bismarchipires.com.br")) {
    variants.push(variants[0].replace("@bismarchipires.com.br", "@bpplaw.com.br"));
  }

  const token = await getGraphAccessToken(graphConfig);
  for (const addr of variants) {
    const logonName = `i:0#.f|membership|${addr}`;
    try {
      const res = await fetch(`${webUrl}/_api/web/ensureUser`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json;odata=nometadata",
          "Content-Type": "application/json;odata=nometadata",
        },
        body: JSON.stringify({ logonName }),
      });
      if (!res.ok) continue;
      const json = await res.json().catch(() => ({}));
      const id = json?.Id ?? json?.id ?? json?.d?.Id;
      if (id) return String(id);
    } catch {
      // próxima variante
    }
  }

  return null;
}
