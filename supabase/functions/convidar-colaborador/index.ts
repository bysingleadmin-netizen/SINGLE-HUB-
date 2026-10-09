// Edge Function: convida um colaborador por e-mail.
//
// Existe porque o convite (auth.admin.inviteUserByEmail) exige a chave de serviço,
// que dá acesso total ao banco e por isso nunca pode ir para o navegador.
// Aqui ela fica no servidor, e a função só convida se quem pediu for da liderança.
//
// Publicar: supabase functions deploy convidar-colaborador --project-ref <ref do projeto>
// O nome precisa ser exatamente `convidar-colaborador`: é por ele que o app chama.
//
// O Supabase já entrega SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY às
// Edge Functions. Se alguma faltar (projeto com as chaves novas, por exemplo), a função
// responde dizendo qual, em vez de cair com um erro 500 sem explicação. Nesse caso,
// cadastre o segredo em Edge Functions > Secrets.

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
// `detalhe` leva a mensagem técnica original e também vai para o log da função.
async function convidar(req: Request): Promise<Response> {
  if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization')
  if (!autorizacao) return responder({ erro: 'Entre no sistema para convidar.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const chaveAnonima = Deno.env.get('SUPABASE_ANON_KEY')
  const chaveDeServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const faltando = [
    !url && 'SUPABASE_URL',
    !chaveAnonima && 'SUPABASE_ANON_KEY',
    !chaveDeServico && 'SUPABASE_SERVICE_ROLE_KEY',
  ].filter(Boolean)
  if (!url || !chaveAnonima || !chaveDeServico) {
    console.error('convidar-colaborador: variáveis ausentes', faltando)
    return responder({
      erro: `A função de convite está sem configuração: falta ${faltando.join(', ')} em Edge Functions > Secrets no Supabase.`,
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
    console.error('convidar-colaborador: leitura do perfil', erroPerfil)
    return responder({ erro: 'Não foi possível conferir o seu cargo.', detalhe: erroPerfil.message })
  }
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

  const admin = createClient(url, chaveDeServico, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error) {
    console.error('convidar-colaborador: inviteUserByEmail', error.status, error.message)
    if (error.status === 422 || /already/i.test(error.message)) {
      return responder({ erro: 'Este e-mail já tem acesso ao sistema.' })
    }
    if (error.status === 429 || /rate limit/i.test(error.message)) {
      return responder({
        erro: 'O Supabase atingiu o limite de e-mails por hora. Tente mais tarde ou configure um SMTP próprio.',
        detalhe: error.message,
      })
    }
    return responder({
      erro: `O Supabase não conseguiu enviar o convite: ${error.message}`,
      detalhe: error.message,
    })
  }

  return responder({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    return await convidar(req)
  } catch (falha) {
    // Qualquer erro inesperado volta com o motivo, para não virar um 500 mudo no app
    const detalhe = falha instanceof Error ? falha.message : String(falha)
    console.error('convidar-colaborador: erro inesperado', falha)
    return responder({ erro: `A função de convite falhou: ${detalhe}`, detalhe }, 500)
  }
})
