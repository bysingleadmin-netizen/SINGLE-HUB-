// Edge Function: traz do Asaas todas as cobranças que já existem e grava em receitas_asaas.
//
// O webhook só recebe o que acontece depois de cadastrado; esta função faz a carga inicial e
// pode ser chamada de novo a qualquer momento (botão "Sincronizar Asaas" no Financeiro): cada
// cobrança é gravada pelo id do Asaas, então nada se repete.
//
// Publicar: supabase functions deploy asaas-sync --project-ref <ref do projeto>
// Segredos em Edge Functions > Secrets: ASAAS_API_KEY (a chave da API do Asaas, em
// Integrações > Chaves de API). ASAAS_API_URL é opcional: só para usar o sandbox
// (https://api-sandbox.asaas.com/v3). SUPABASE_URL, SUPABASE_ANON_KEY e
// SUPABASE_SERVICE_ROLE_KEY o Supabase já entrega.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { API_ASAAS, FalhaDoAsaas, linhaDoPagamento, listarTudo, vincularClientes } from '../_shared/asaas.ts'
import type { ClienteAsaas, PagamentoAsaas } from '../_shared/asaas.ts'
import { CARGOS_LIDERANCA } from '../_shared/acesso.ts'
import { carregarClientes, gravarCobrancas, gravarIdsDoAsaas } from '../_shared/banco.ts'

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
async function sincronizar(req: Request): Promise<Response> {
  if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405)

  const autorizacao = req.headers.get('Authorization')
  if (!autorizacao) return responder({ erro: 'Entre no sistema para sincronizar.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const chaveAnonima = Deno.env.get('SUPABASE_ANON_KEY')
  const chaveDeServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const chaveAsaas = Deno.env.get('ASAAS_API_KEY')
  const faltando = [
    !url && 'SUPABASE_URL',
    !chaveAnonima && 'SUPABASE_ANON_KEY',
    !chaveDeServico && 'SUPABASE_SERVICE_ROLE_KEY',
    !chaveAsaas && 'ASAAS_API_KEY',
  ].filter(Boolean)
  if (!url || !chaveAnonima || !chaveDeServico || !chaveAsaas) {
    console.error('asaas-sync: segredos ausentes', faltando)
    return responder({
      erro: `A sincronização está sem configuração: falta ${faltando.join(', ')} em Edge Functions > Secrets no Supabase.`,
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
    console.error('asaas-sync: leitura do perfil', erroPerfil)
    return responder({ erro: 'Não foi possível conferir o seu cargo.', detalhe: erroPerfil.message })
  }
  if (!perfil || !CARGOS_LIDERANCA.includes(perfil.cargo)) {
    return responder({ erro: 'Apenas a liderança pode sincronizar o Asaas.' })
  }

  const base = Deno.env.get('ASAAS_API_URL') ?? API_ASAAS
  let clientesAsaas: ClienteAsaas[]
  let pagamentos: PagamentoAsaas[]
  try {
    ;[clientesAsaas, pagamentos] = await Promise.all([
      listarTudo<ClienteAsaas>(base, '/customers', chaveAsaas),
      listarTudo<PagamentoAsaas>(base, '/payments', chaveAsaas),
    ])
  } catch (falha) {
    console.error('asaas-sync: leitura do Asaas', falha)
    if (falha instanceof FalhaDoAsaas && falha.status === 401) {
      return responder({ erro: 'O Asaas recusou a chave da API. Confira ASAAS_API_KEY em Edge Functions > Secrets.' })
    }
    const detalhe = falha instanceof Error ? falha.message : String(falha)
    return responder({ erro: `Não foi possível ler o Asaas: ${detalhe}`, detalhe })
  }

  const db = createClient(url, chaveDeServico, { auth: { persistSession: false } })
  const vinculos = vincularClientes(await carregarClientes(db), clientesAsaas)
  const clientesLigados = await gravarIdsDoAsaas(db, vinculos)

  const porId = new Map(clientesAsaas.map((cliente) => [cliente.id, cliente]))
  const agora = new Date().toISOString()
  const cobrancas = pagamentos.map((pagamento) => ({
    linha: linhaDoPagamento(pagamento, agora, pagamento.customer ? porId.get(pagamento.customer) : null),
    clienteId: (pagamento.customer && vinculos.get(pagamento.customer)?.clienteId) || null,
  }))
  await gravarCobrancas(db, cobrancas)

  const vinculadas = cobrancas.filter((c) => c.clienteId).length
  return responder({
    ok: true,
    cobrancas: cobrancas.length,
    vinculadas,
    semVinculo: cobrancas.length - vinculadas,
    clientesLigados,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    return await sincronizar(req)
  } catch (falha) {
    const detalhe = falha instanceof Error ? falha.message : String(falha)
    console.error('asaas-sync: erro inesperado', falha)
    return responder({ erro: `A sincronização falhou: ${detalhe}`, detalhe }, 500)
  }
})
