import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Tabela } from './base'

// Códigos que o Postgres e a API devolvem quando a coluna pedida (ou a tabela inteira) não existe
const AUSENTE = new Set(['42703', 'PGRST204', 'PGRST205', '42P01'])

async function existe(tabela: Tabela, coluna: string): Promise<boolean> {
  const { error } = await supabase.from(tabela).select(coluna).limit(0)
  if (!error) return true
  if (AUSENTE.has(error.code)) return false
  throw error
}

/**
 * O que o banco já tem das migrations opcionais. O app funciona sem elas; cada coluna só
 * acrescenta um detalhe, e a tela correspondente se adapta.
 */
const SONDAS = {
  // migration 0002 (repetidas na 0003)
  diaVencimento: ['clients', 'dia_vencimento'],
  formaPagamento: ['client_payments', 'forma_pagamento'],
  // migration 0003: histórico de pagamentos e status "cancelado"
  arquivado: ['client_payments', 'arquivado'],
  // já existe no banco do SINGLE, criada pelo painel
  prioridadeTarefa: ['tasks', 'prioridade'],
  // migration 0003
  prioridadeConteudo: ['content_cards', 'prioridade'],
  // migration 0003: concluded_at e archived_at (arquivo automático)
  cicloTarefa: ['tasks', 'concluded_at'],
  cicloConteudo: ['content_cards', 'concluded_at'],
  // migration 0004: duração do contrato de fidelidade
  contratoMeses: ['clients', 'contrato_meses'],
  // migration 0004: pagamento parcial, data do recebimento, observação e valor manual
  pagamentoParcial: ['client_payments', 'valor_pago'],
  // migration 0004: cor de cada opção configurável
  corDasOpcoes: ['card_options', 'cor'],
  // migration 0004: quadro de Tarefas internas na tabela tasks
  quadroTarefas: ['tasks', 'quadro'],
  // migration 0004: posição das tarefas de anúncio no quadro
  posicaoAnuncio: ['campaign_tasks', 'posicao'],
  // migration 0007: CNPJ do cliente, para ligar ao cliente do Asaas
  cnpj: ['clients', 'cnpj'],
} as const satisfies Record<string, readonly [Tabela, string]>

export type ColunaOpcional = keyof typeof SONDAS

/** Enquanto a checagem não termina, `pronto` vem false e tudo conta como ausente. */
export function useColunasOpcionais(): Record<ColunaOpcional, boolean> & { pronto: boolean } {
  const consulta = useQuery({
    queryKey: ['esquema'],
    staleTime: Infinity,
    queryFn: async () => {
      const nomes = Object.keys(SONDAS) as ColunaOpcional[]
      const resultados = await Promise.all(nomes.map((nome) => existe(SONDAS[nome][0], SONDAS[nome][1])))
      return Object.fromEntries(nomes.map((nome, i) => [nome, resultados[i]])) as Record<ColunaOpcional, boolean>
    },
  })
  const colunas = Object.fromEntries(
    (Object.keys(SONDAS) as ColunaOpcional[]).map((nome) => [nome, consulta.data?.[nome] ?? false]),
  ) as Record<ColunaOpcional, boolean>
  return { ...colunas, pronto: !consulta.isPending }
}
