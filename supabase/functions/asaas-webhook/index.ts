// Edge Function: recebe os eventos de cobrança do Asaas e grava em receitas_asaas.
//
// Publicar (o Asaas não manda o token de login do Supabase, por isso sem verificar JWT):
//   supabase functions deploy asaas-webhook --no-verify-jwt --project-ref <ref do projeto>
// URL para cadastrar no Asaas (Integrações > Webhooks):
//   https://<ref do projeto>.supabase.co/functions/v1/asaas-webhook
//
// Segredos em Edge Functions > Secrets: ASAAS_WEBHOOK_TOKEN (o mesmo token cadastrado no
// webhook do Asaas) e ASAAS_API_KEY (para buscar o nome e o CNPJ do cliente, que o evento não
// traz). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já entrega.
//
// Fora o token errado (401), a resposta é sempre 200: o Asaas reenvia o que recebe 4xx/5xx e,
// depois de várias falhas seguidas, pausa a fila de eventos. Falhas internas vão para o log.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  API_ASAAS,
  acharClienteDoAsaas,
  buscarClienteAsaas,
  linhaDaCobranca,
  tokenValido,
} from '../_shared/asaas.ts'
import type { ClienteAsaas, EventoAsaas } from '../_shared/asaas.ts'
import { carregarClientes, gravarCobrancas, gravarIdsDoAsaas } from '../_shared/banco.ts'

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Nome e CNPJ do cliente no Asaas. Sem a chave da API, só o que veio no evento. */
async function clienteDoEvento(evento: EventoAsaas): Promise<ClienteAsaas | null> {
  const id = evento.payment?.customer
  if (!id) return null
  const chave = Deno.env.get('ASAAS_API_KEY')
  if (chave) {
    try {
      const doAsaas = await buscarClienteAsaas(Deno.env.get('ASAAS_API_URL') ?? API_ASAAS, id, chave)
      if (doAsaas) return doAsaas
    } catch (erro) {
      console.error('asaas-webhook: não buscou o cliente no Asaas', id, erro)
    }
  }
  return { id, name: evento.payment?.customerName ?? null }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responder({ erro: 'Método não permitido.' }, 405)

  if (!tokenValido(req.headers.get('asaas-access-token'), Deno.env.get('ASAAS_WEBHOOK_TOKEN'))) {
    return responder({ erro: 'Token inválido.' }, 401)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const chaveDeServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chaveDeServico) {
    console.error('asaas-webhook: falta SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em Secrets')
    return responder({ ok: true })
  }

  let evento: EventoAsaas
  try {
    evento = await req.json()
  } catch {
    console.error('asaas-webhook: corpo não é JSON')
    return responder({ ok: true })
  }

  // Eventos que não são de cobrança (assinatura, conta...) ficam para depois
  if (!linhaDaCobranca(evento, '')) return responder({ ok: true })

  try {
    const cliente = await clienteDoEvento(evento)
    const linha = linhaDaCobranca(evento, new Date().toISOString(), cliente)!
    const db = createClient(url, chaveDeServico, { auth: { persistSession: false } })
    const vinculo = cliente ? acharClienteDoAsaas(await carregarClientes(db), cliente) : null
    if (cliente && vinculo) await gravarIdsDoAsaas(db, new Map([[cliente.id, vinculo]]))
    // Sem cliente achado, cliente_id e vinculado ficam de fora: numa cobrança nova valem os
    // padrões (sem vínculo); numa já vinculada à mão, o vínculo continua.
    await gravarCobrancas(db, [{ linha, clienteId: vinculo?.clienteId ?? null }])
  } catch (erro) {
    console.error('asaas-webhook: não gravou a cobrança', evento.payment?.id, erro)
  }
  return responder({ ok: true })
})
