/**
 * Gera payload UTF-8 para deploy da Edge Function sharepoint-treinamentos.
 * Uso: node scripts/build-sharepoint-deploy-payload.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = 'supabase/functions/sharepoint-treinamentos';
const files = [
  'index.ts',
  '_shared/cors.ts',
  '_shared/graphClient.ts',
  '_shared/sharepointPerson.ts',
  '_shared/treinamentosList.ts',
].map(
  (name) => ({
    name,
    content: fs.readFileSync(path.join(root, name), 'utf8'),
  }),
);

const payload = {
  name: 'sharepoint-treinamentos',
  entrypoint_path: 'index.ts',
  verify_jwt: true,
  files,
};

fs.writeFileSync('scripts/.deploy-sharepoint-payload.json', JSON.stringify(payload), 'utf8');
console.log('Payload gerado:', files.map((f) => f.name).join(', '));
