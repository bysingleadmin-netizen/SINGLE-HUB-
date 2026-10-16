// Conferência de quem chama uma Edge Function: sessão válida e cargo da liderança.
//
// O Supabase já entrega SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY às Edge
// Functions. Se alguma faltar, a função responde dizendo qual, em vez de cair com um erro 500
// sem explicação.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/** Liderança: o cargo novo e, até a migration 0010 rodar, os três antigos */
export const CARGOS_LIDERANCA = ['Liderança', 'CEO', 'Founder', 'Co-Founder']

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

export interface Acesso {
  /** Cliente com a chave de serviço: passa por cima da RLS */
  admin: SupabaseClient
  usuarioId: string
}

/**
 * Confere a sessão de quem chamou e se é da liderança. Devolve o acesso, ou a resposta de
 * recusa pronta (status 200 com `erro`, que o app mostra à pessoa).
 */
export async function exigirLideranca(req: Request, nome: string, acao: string): Promise<Acesso | Response> {
  const autorizacao = req.headers.get('Authorization')
  if (!autorizacao) return responder({ erro: `Entre no sistema para ${acao}.` }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const chaveAnonima = Deno.env.get('SUPABASE_ANON_KEY')
  const chaveDeServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const faltando = [
    !url && 'SUPABASE_URL',
    !chaveAnonima && 'SUPABASE_ANON_KEY',
    !chaveDeServico && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)
  if (!url || !chaveAnonima || !chaveDeServico) {
    console.error(`${nome}: variáveis ausentes`, faltando)
    return responder({
      erro: `A função ${nome} está sem configuração: falta ${faltando.join(', ')} em Edge Functions > Secrets no Supabase.`,
    })
  }

  const comoUsuario = createClient(url, chaveAnonima, {
    global: { headers: { Authorization: autorizacao } },
  })
  const { data: sessao, error: erroSessao } = await comoUsuario.auth.getUser(
    autorizacao.replace(/^Bearer\s+/i, ''),
  )
  if (erroSessao || !sessao.user) {
    return responder({ erro: 'Sessão inválida. Entre de novo.', detalhe: erroSessao?.message }, 401)
  }

  const { data: perfil, error: erroPerfil } = await comoUsuario
    .from('profiles')
    .select('cargo')
    .eq('id', sessao.user.id)
    .maybeSingle()
  if (erroPerfil) {
    console.error(`${nome}: leitura do perfil`, erroPerfil)
    return responder({ erro: 'Não foi possível conferir o seu cargo.', detalhe: erroPerfil.message })
  }
  if (!perfil || !CARGOS_LIDERANCA.includes(perfil.cargo)) {
    return responder({ erro: `Apenas a liderança pode ${acao}.` })
  }

  const admin = createClient(url, chaveDeServico, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return { admin, usuarioId: sessao.user.id }
}

/** Roda a função e transforma qualquer erro inesperado numa resposta com o motivo */
export function servir(nome: string, tratar: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
    if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405)
    try {
      return await tratar(req)
    } catch (falha) {
      const detalhe = falha instanceof Error ? falha.message : String(falha)
      console.error(`${nome}: erro inesperado`, falha)
      return responder({ erro: `A função ${nome} falhou: ${detalhe}`, detalhe }, 500)
    }
  })
}
