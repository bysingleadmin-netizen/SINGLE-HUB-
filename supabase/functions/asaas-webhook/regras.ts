// Regras do webhook do Asaas, sem nada do Deno nem do Supabase: o index.ts usa e os testes do
// app (vitest) conferem.

export interface PagamentoAsaas {
  id: string
  customer?: string | null
  customerName?: string | null
  description?: string | null
  value?: number | null
  dueDate?: string | null
  paymentDate?: string | null
  status?: string | null
  billingType?: string | null
  subscription?: string | null
}

export interface EventoAsaas {
  event?: string
  payment?: PagamentoAsaas
}

export interface LinhaDaCobranca {
  asaas_id: string
  asaas_customer_id: string | null
  nome_cliente_asaas: string | null
  descricao: string | null
  valor: number | null
  data_vencimento: string | null
  data_pagamento: string | null
  status: string | null
  forma_pagamento: string | null
  tipo: string | null
  atualizado_em: string
}

/**
 * O header asaas-access-token bate com o segredo? Sem segredo configurado, nada passa.
 * A comparação percorre tudo, para o tempo de resposta não revelar quanto do token acertou.
 */
export function tokenValido(recebido: string | null, esperado: string | undefined): boolean {
  if (!esperado || recebido == null) return false
  const a = new TextEncoder().encode(recebido)
  const b = new TextEncoder().encode(esperado)
  let diferenca = a.length ^ b.length
  for (let i = 0; i < b.length; i++) diferenca |= (a[i] ?? 0) ^ b[i]
  return diferenca === 0
}

/** A linha de receitas_asaas de um evento de cobrança (PAYMENT_*); null para os outros eventos. */
export function linhaDaCobranca(evento: EventoAsaas, agora: string): LinhaDaCobranca | null {
  const pagamento = evento.payment
  if (!evento.event?.startsWith('PAYMENT_') || !pagamento?.id) return null
  return {
    asaas_id: pagamento.id,
    asaas_customer_id: pagamento.customer ?? null,
    nome_cliente_asaas: pagamento.customerName ?? null,
    descricao: pagamento.description ?? null,
    valor: pagamento.value ?? null,
    data_vencimento: pagamento.dueDate ?? null,
    data_pagamento: pagamento.paymentDate ?? null,
    // Na exclusão o Asaas manda a cobrança como ela estava; aqui ela passa a contar como excluída
    status: evento.event === 'PAYMENT_DELETED' ? 'DELETED' : (pagamento.status ?? null),
    forma_pagamento: pagamento.billingType ?? null,
    tipo: pagamento.subscription ? 'SUBSCRIPTION' : (pagamento.billingType ?? null),
    atualizado_em: agora,
  }
}

/**
 * Trecho do nome do cliente do Asaas para procurar o cliente daqui (ILIKE '%termo%'): as duas
 * primeiras palavras, sem pontuação, com os curingas % e _ escapados. Null se ficar curto demais
 * para uma busca que não pegue clientes por acaso.
 */
export function termoDoNome(nome: string | null | undefined): string | null {
  const palavras = (nome ?? '')
    .split(/\s+/)
    .map((palavra) => palavra.replace(/[^\p{L}\p{N}%_]/gu, ''))
    .filter(Boolean)
    .slice(0, 2)
  const termo = palavras.join(' ')
  if (termo.length < 3) return null
  return termo.replace(/[%_]/g, (curinga) => `\\${curinga}`)
}
