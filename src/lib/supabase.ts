import { createClient } from '@supabase/supabase-js'

// main.tsx só carrega o app (e este módulo) depois de confirmar que as duas
// variáveis existem; sem elas o usuário vê a tela "Configuração pendente".
export const supabase = createClient(
  (import.meta.env.VITE_SUPABASE_URL ?? '').trim(),
  (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
)
