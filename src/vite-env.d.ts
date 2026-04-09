/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Opcional — só se precisar no cliente; a Evolution é chamada via Edge Function. */
  readonly VITE_EVOLUTION_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
