/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_PROJECT_ID: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  // Development auto-login (set to 'true' to enable)
  readonly VITE_DEV_AUTO_LOGIN?: string;
  readonly VITE_DEV_USER_EMAIL?: string;
  readonly VITE_DEV_USER_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
