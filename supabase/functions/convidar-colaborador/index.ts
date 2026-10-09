// Edge Function: convida um colaborador por e-mail.
//
// Existe porque o convite (auth.admin.inviteUserByEmail) exige a chave de serviço,
// que dá acesso total ao banco e por isso nunca pode ir para o navegador.
// Aqui ela fica no servidor, e a função só convida se quem pediu for da liderança.
//
// Publicar: supabase functions deploy convidar-colaborador
// As variáveis SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já
// existem no ambiente das Edge Functions; não é preciso cadastrar nada.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CARGOS_LIDERANCA = ['CEO', 'Founder', 'Co-Founder']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// Recusas esperadas voltam com status 200 e o campo `erro`, que o app mostra à pessoa.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization')
  if (!autorizacao) return responder({ erro: 'Entre no sistema para convidar.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const comoUsuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorizacao } },
  })

  const { data: sessao, error: erroSessao } = await comoUsuario.auth.getUser()
  if (erroSessao || !sessao.user) return responder({ erro: 'Sessão inválida. Entre de novo.' }, 401)

  const { data: perfil } = await comoUsuario
    .from('profiles')
    .select('cargo')
    .eq('id', sessao.user.id)
    .maybeSingle()
  if (!perfil || !CARGOS_LIDERANCA.includes(perfil.cargo)) {
    return responder({ erro: 'Apenas a liderança pode convidar colaboradores.' })
  }

  let email = ''
  try {
    email = String((await req.json()).email ?? '').trim().toLowerCase()
  } catch {
    // corpo ausente ou inválido cai na validação abaixo
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return responder({ erro: 'Informe um e-mail válido.' })
  }

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error) {
    const jaExiste = error.status === 422 || /already/i.test(error.message)
    return responder({
      erro: jaExiste
        ? 'Este e-mail já tem acesso ao sistema.'
        : 'O Supabase não conseguiu enviar o convite. Tente de novo em instantes.',
    })
  }

  return responder({ ok: true })
})
