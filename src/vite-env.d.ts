/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Endereço oficial do sistema, usado nos links enviados a clientes */
  readonly VITE_URL_PUBLICA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
