// Gravação das cobranças do Asaas no banco, comum ao webhook e à sincronização.
// Usa a chave de serviço, que não passa pela RLS.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { ClienteDaqui, LinhaDaCobranca, Vinculo } from './asaas.ts'

/** Clientes daqui. `*` para funcionar antes e depois da coluna cnpj (migration 0007). */
export async function carregarClientes(db: SupabaseClient): Promise<ClienteDaqui[]> {
  const { data, error } = await db.from('clients').select('*')
  if (error) throw error
  return (data ?? []) as ClienteDaqui[]
}

/** Grava o id do Asaas nos clientes achados por CNPJ ou nome, sem trocar um id já gravado. */
export async function gravarIdsDoAsaas(db: SupabaseClient, vinculos: Map<string, Vinculo>): Promise<number> {
  let gravados = 0
  for (const [asaasId, vinculo] of vinculos) {
    if (!vinculo.gravarId) continue
    const { error } = await db
      .from('clients')
      .update({ asaas_customer_id: asaasId })
      .eq('id', vinculo.clienteId)
      .is('asaas_customer_id', null)
    if (error) throw error
    gravados++
  }
  return gravados
}

const LOTE = 500

/**
 * Grava ou atualiza as cobranças pelo id do Asaas. As vinculadas levam cliente_id e
 * vinculado; as outras vão sem esses campos, para não desfazer um vínculo feito à mão.
 * (Num upsert em lote, campo ausente em uma linha vira null em todas: por isso os dois grupos.)
 */
export async function gravarCobrancas(
  db: SupabaseClient,
  cobrancas: { linha: LinhaDaCobranca; clienteId: string | null }[],
): Promise<void> {
  const vinculadas = cobrancas
    .filter((c) => c.clienteId)
    .map((c) => ({ ...c.linha, cliente_id: c.clienteId, vinculado: true }))
  const soltas = cobrancas.filter((c) => !c.clienteId).map((c) => c.linha)
  for (const grupo of [vinculadas, soltas]) {
    for (let i = 0; i < grupo.length; i += LOTE) {
      const { error } = await db
        .from('receitas_asaas')
        .upsert(grupo.slice(i, i + LOTE), { onConflict: 'asaas_id' })
      if (error) throw error
    }
  }
}
