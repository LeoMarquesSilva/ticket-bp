/**
 * Gera um par de chaves VAPID para Web Push.
 * Rode uma vez: node scripts/generate-vapid.cjs
 * Copie as chaves para o .env (backend) e .env com VITE_VAPID_PUBLIC_KEY (frontend).
 */
const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('\n=== Chaves VAPID (guarde em .env) ===\n');
console.log('# Backend (API / Edge Function) - NUNCA exponha a private no frontend');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('\n# Frontend (.env) - só a pública');
console.log('VITE_VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('\n=====================================\n');
