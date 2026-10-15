import { createClient } from '@supabase/supabase-js'
import { armazenamentoDaSessao } from './sessao'

// main.tsx só carrega o app (e este módulo) depois de confirmar que as duas
// variáveis existem; sem elas o usuário vê a tela "Configuração pendente".
// A sessão fica onde o "Lembrar minha conta" do login mandar (lib/sessao.ts).
export const supabase = createClient(
  (import.meta.env.VITE_SUPABASE_URL ?? '').trim(),
  (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim(),
  { auth: { persistSession: true, storage: armazenamentoDaSessao } },
)
