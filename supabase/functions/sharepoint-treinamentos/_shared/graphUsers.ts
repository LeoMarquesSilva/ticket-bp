import { graphFetch } from "./graphClient.ts";

const GRAPH_USERS_KEY = "sharepoint_graph_user_ids";

let cachedGraphUsers: Record<string, string> | null = null;

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function emailVariants(email: string): string[] {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return [];
  const variants = new Set<string>([trimmed]);
  if (trimmed.endsWith("@bismarchipires.com.br")) {
    variants.add(trimmed.replace("@bismarchipires.com.br", "@bpplaw.com.br"));
  }
  if (trimmed.endsWith("@bpplaw.com.br")) {
    variants.add(trimmed.replace("@bpplaw.com.br", "@bismarchipires.com.br"));
  }
  return [...variants];
}

export async function loadGraphUserIdCache(
  admin?: { from: (table: string) => unknown },
): Promise<Record<string, string>> {
  if (cachedGraphUsers) return cachedGraphUsers;

  const map: Record<string, string> = {};
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
      .eq("key", GRAPH_USERS_KEY)
      .maybeSingle();

    const raw = data?.value?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const [key, id] of Object.entries(parsed)) {
          if (id) map[normalizeKey(key)] = String(id);
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }

  cachedGraphUsers = map;
  return map;
}

function cacheHit(
  cache: Record<string, string>,
  email: string,
  displayName: string,
): string | null {
  for (const variant of emailVariants(email)) {
    const byEmail = cache[normalizeKey(variant)];
    if (byEmail) return byEmail;
  }
  const byName = cache[normalizeKey(displayName)];
  if (byName) return byName;
  return null;
}

async function fetchGraphUserByEmail(email: string): Promise<string | null> {
  const upnRes = await graphFetch(
    `/users/${encodeURIComponent(email)}?$select=id,mail,userPrincipalName`,
  );
  if (upnRes.ok) {
    const json = await upnRes.json().catch(() => ({}));
    if (json.id) return String(json.id);
  }

  const escaped = email.replace(/'/g, "''");
  const filter = encodeURIComponent(
    `mail eq '${escaped}' or userPrincipalName eq '${escaped}'`,
  );
  const res = await graphFetch(
    `/users?$filter=${filter}&$select=id,mail,userPrincipalName&$top=1`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  const user = json.value?.[0];
  return user?.id ? String(user.id) : null;
}

/** Resolve Azure AD user id (Graph) a partir do e-mail — requer User.Read.All no app. */
export async function resolveGraphUserIdByEmail(
  email: string,
  displayName: string,
  admin?: { from: (table: string) => unknown },
): Promise<string | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const cache = await loadGraphUserIdCache(admin);
  const cached = cacheHit(cache, trimmed, displayName);
  if (cached) return cached;

  for (const variant of emailVariants(trimmed)) {
    const id = await fetchGraphUserByEmail(variant);
    if (id) return id;
  }

  return null;
}

export function personOdataBindFieldName(columnInternalName: string): string {
  return `${columnInternalName}@odata.bind`;
}

export function graphUserBindUrl(graphUserId: string): string {
  return `https://graph.microsoft.com/v1.0/users('${graphUserId}')`;
}

/** Retorna mail/UPN canônicos do usuário no Graph (requer id já resolvido). */
export async function fetchGraphUserEmails(graphUserId: string): Promise<string[]> {
  const res = await graphFetch(
    `/users/${encodeURIComponent(graphUserId)}?$select=id,mail,userPrincipalName`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.id) return [];
  const emails = new Set<string>();
  for (const v of [json.mail, json.userPrincipalName]) {
    if (typeof v === "string" && v.trim()) emails.add(v.trim().toLowerCase());
  }
  return [...emails];
}

export async function persistGraphUserId(
  admin: { from: (table: string) => unknown },
  email: string,
  displayName: string,
  graphUserId: string,
): Promise<void> {
  if (!graphUserId.trim()) return;

  const cache = await loadGraphUserIdCache(admin);
  const next = { ...cache };
  let changed = false;

  const add = (key: string, id: string) => {
    const k = normalizeKey(key);
    if (!k || next[k] === id) return;
    next[k] = id;
    changed = true;
  };

  add(email, graphUserId);
  add(displayName, graphUserId);
  for (const variant of emailVariants(email)) add(variant, graphUserId);

  if (!changed) return;

  cachedGraphUsers = next;
  await (admin as {
    from: (table: string) => {
      upsert: (
        row: Record<string, string>,
        opts: { onConflict: string },
      ) => Promise<unknown>;
    };
  })
    .from("app_c009c0e4f1_integration_settings")
    .upsert(
      {
        key: GRAPH_USERS_KEY,
        value: JSON.stringify(next),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}
