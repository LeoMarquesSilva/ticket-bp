/**
 * Publica uma Edge Function no projeto Supabase usando o mesmo payload JSON
 * que o MCP deploy_edge_function (útil quando o token do CLI não está no ambiente).
 *
 * Uso:
 *   set SUPABASE_ACCESS_TOKEN=sbp_xxxx
 *   node scripts/mcp-deploy-fn.mjs deploy-evolution-admin.arg.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRef = "jhgbrbarfpvgdaaznldj";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const file = process.argv[2];

if (!token) {
  console.error("Defina SUPABASE_ACCESS_TOKEN (token pessoal em supabase.com/dashboard/account/tokens).");
  process.exit(1);
}
if (!file) {
  console.error("Uso: node scripts/mcp-deploy-fn.mjs <arquivo.json>");
  process.exit(1);
}

const body = JSON.parse(readFileSync(resolve(file), "utf8"));
const { name: slug, entrypoint_path, verify_jwt, files } = body;

const form = new FormData();
form.append(
  "metadata",
  JSON.stringify({ name: slug, entrypoint_path, verify_jwt }),
);

for (const f of files) {
  form.append("file", new Blob([f.content], { type: "application/typescript" }), f.name);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${encodeURIComponent(slug)}`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  },
);

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = text;
}

if (!res.ok) {
  console.error(res.status, json);
  process.exit(1);
}

console.log(JSON.stringify(json, null, 2));
