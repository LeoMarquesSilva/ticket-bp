import { graphFetch } from "./graphClient.ts";

const SETTINGS_KEY = "sharepoint_person_lookups";
const PERSON_FIELD_DISPLAYS = new Set([
  "responsavel",
  "responsavel (gerente da area)",
  "gerente da area",
]);

let cachedLookups: Record<string, string> | null = null;

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function emailVariants(email: string): string[] {
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

export async function loadSharepointPersonLookups(
  admin?: { from: (table: string) => unknown },
): Promise<Record<string, string>> {
  if (cachedLookups) return cachedLookups;

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
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    const raw = data?.value?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        for (const [key, lookupId] of Object.entries(parsed)) {
          if (lookupId) map[normalizeKey(key)] = String(lookupId);
        }
      } catch {
        // ignore invalid JSON
      }
    }
  }

  cachedLookups = map;
  return map;
}

export function resolveSharepointPersonLookupId(
  email: string,
  displayName: string,
  lookups: Record<string, string>,
): string | null {
  for (const variant of emailVariants(email)) {
    const byEmail = lookups[normalizeKey(variant)];
    if (byEmail) return byEmail;
  }

  const byName = lookups[normalizeKey(displayName)];
  if (byName) return byName;

  return null;
}

export function isPersonFieldDisplayName(displayName: string): boolean {
  return PERSON_FIELD_DISPLAYS.has(normalizeKey(displayName));
}

export function personLookupFieldName(columnInternalName: string): string {
  return `${columnInternalName}LookupId`;
}

/** Fallback: correlaciona e-mail/nome com LookupId usado em itens históricos da lista. */
export async function persistSharepointPersonLookup(
  admin: { from: (table: string) => unknown },
  email: string,
  displayName: string,
  lookupId: string,
): Promise<void> {
  if (!lookupId?.trim()) return;

  const lookups = await loadSharepointPersonLookups(admin);
  const next = { ...lookups };
  let changed = false;

  const add = (key: string, id: string) => {
    const k = normalizeKey(key);
    if (!k || next[k] === id) return;
    next[k] = id;
    changed = true;
  };

  add(email, lookupId);
  add(displayName, lookupId);
  for (const variant of emailVariants(email)) add(variant, lookupId);

  if (!changed) return;

  cachedLookups = next;
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
        key: SETTINGS_KEY,
        value: JSON.stringify(next),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}

export async function resolveSharepointPersonLookupIdFull(
  email: string,
  displayName: string,
  siteId: string,
  listId: string,
  admin?: { from: (table: string) => unknown },
): Promise<string | null> {
  const lookups = await loadSharepointPersonLookups(admin);

  for (const variant of emailVariants(email)) {
    const byEmail = resolveSharepointPersonLookupId(variant, displayName, lookups);
    if (byEmail) return byEmail;
  }

  const inferred = await inferSharepointPersonLookupId(email, displayName, siteId, listId);
  if (inferred) return inferred;

  return null;
}

export async function inferSharepointPersonLookupId(
  email: string,
  displayName: string,
  siteId: string,
  listId: string,
): Promise<string | null> {
  const res = await graphFetch(
    `/sites/${siteId}/lists/${listId}/items?expand=fields&$select=id,fields&$top=200`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;

  const scores = new Map<string, number>();
  const normalizedName = normalizeKey(displayName);
  const emailSet = new Set(emailVariants(email));

  for (const item of json.value ?? []) {
    const fields = item.fields ?? {};
    const lookupId = fields.Respons_x00e1_velLookupId ?? fields.ResponsavelLookupId;
    if (!lookupId) continue;

    const facilitador = normalizeKey(String(fields.Facilitador ?? ""));
    const responsavelText = normalizeKey(String(fields.Respons_x00e1_vel ?? ""));

    let matched = false;
    if (normalizedName && (facilitador.includes(normalizedName) || responsavelText.includes(normalizedName))) {
      matched = true;
    }
    for (const variant of emailSet) {
      if (responsavelText.includes(variant.replace("@", ""))) matched = true;
    }

    if (matched) {
      const key = String(lookupId);
      scores.set(key, (scores.get(key) ?? 0) + 1);
    }
  }

  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return best?.[0] ?? null;
}
