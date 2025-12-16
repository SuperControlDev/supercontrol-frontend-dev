/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_REDIRECT_URI?: string;
  readonly VITE_RED5PRO_LICENSE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

