// Edge Function: recebe os eventos de cobrança do Asaas e grava em receitas_asaas.
//
// Publicar (o Asaas não manda o token de login do Supabase, por isso sem verificar JWT):
//   supabase functions deploy asaas-webhook --no-verify-jwt --project-ref <ref do projeto>
// URL para cadastrar no Asaas (Integrações > Webhooks):
//   https://<ref do projeto>.supabase.co/functions/v1/asaas-webhook
//
// Segredos em Edge Functions > Secrets: ASAAS_WEBHOOK_TOKEN (o mesmo token cadastrado no
// webhook do Asaas). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já entrega.
//
// Fora o token errado (401), a resposta é sempre 200: o Asaas reenvia o que recebe 4xx/5xx e,
// depois de várias falhas seguidas, pausa a fila de eventos. Falhas internas vão para o log.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { linhaDaCobranca, termoDoNome, tokenValido } from './regras.ts'
import type { EventoAsaas, LinhaDaCobranca } from './regras.ts'

function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * O cliente daqui desta cobrança: primeiro pelo id do Asaas já vinculado; senão, pelo nome,
 * só quando um único cliente casar e ele ainda não tiver outro id do Asaas. Achando pelo nome,
 * o id fica gravado no cliente para os próximos eventos.
 */
async function acharCliente(db: SupabaseClient, linha: LinhaDaCobranca): Promise<string | null> {
  if (linha.asaas_customer_id) {
    const { data, error } = await db
      .from('clients')
      .select('id')
      .eq('asaas_customer_id', linha.asaas_customer_id)
      .limit(1)
    if (error) throw error
    if (data && data.length > 0) return data[0].id as string
  }

  const termo = termoDoNome(linha.nome_cliente_asaas)
  if (!termo || !linha.asaas_customer_id) return null
  const { data, error } = await db
    .from('clients')
    .select('id, asaas_customer_id')
    .ilike('nome', `%${termo}%`)
    .limit(2)
  if (error) throw error
  if (!data || data.length !== 1 || data[0].asaas_customer_id) return null

  const { error: erroVinculo } = await db
    .from('clients')
    .update({ asaas_customer_id: linha.asaas_customer_id })
    .eq('id', data[0].id)
    .is('asaas_customer_id', null)
  if (erroVinculo) throw erroVinculo
  return data[0].id as string
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

  const linha = linhaDaCobranca(evento, new Date().toISOString())
  // Eventos que não são de cobrança (assinatura, conta...) ficam para depois
  if (!linha) return responder({ ok: true })

  try {
    const db = createClient(url, chaveDeServico, { auth: { persistSession: false } })
    const clienteId = await acharCliente(db, linha)
    // Sem cliente achado, cliente_id e vinculado ficam de fora: numa cobrança nova valem os
    // padrões (sem vínculo); numa já vinculada à mão, o vínculo continua.
    const { error } = await db
      .from('receitas_asaas')
      .upsert(clienteId ? { ...linha, cliente_id: clienteId, vinculado: true } : linha, {
        onConflict: 'asaas_id',
      })
    if (error) throw error
  } catch (erro) {
    console.error('asaas-webhook: não gravou a cobrança', linha.asaas_id, erro)
  }
  return responder({ ok: true })
})
