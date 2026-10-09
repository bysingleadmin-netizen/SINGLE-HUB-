import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Códigos que o Postgres e a API devolvem quando a coluna pedida não existe
const COLUNA_AUSENTE = new Set(['42703', 'PGRST204'])

type TabelaSondada = 'clients' | 'client_payments' | 'tasks' | 'content_cards'

async function existe(tabela: TabelaSondada, coluna: string): Promise<boolean> {
  const { error } = await supabase.from(tabela).select(coluna).limit(0)
  if (!error) return true
  if (COLUNA_AUSENTE.has(error.code)) return false
  throw error
}

/**
 * Diz o que o banco já tem das migrations opcionais (0002 e 0003). O app funciona sem elas;
 * cada coluna só acrescenta um detalhe, e a tela correspondente se adapta:
 *   diaVencimento, formaPagamento  -> migration 0002 (repetidas na 0003)
 *   arquivado                      -> migration 0003: histórico de pagamentos e status "cancelado"
 *   prioridadeTarefa               -> já existe no banco do SINGLE, criada pelo painel
 *   prioridadeConteudo             -> migration 0003
 * Enquanto a checagem não termina, `pronto` vem false e tudo conta como ausente.
 */
export function useColunasOpcionais() {
  const consulta = useQuery({
    queryKey: ['esquema'],
    staleTime: Infinity,
    queryFn: async () => {
      const [diaVencimento, formaPagamento, arquivado, prioridadeTarefa, prioridadeConteudo] =
        await Promise.all([
          existe('clients', 'dia_vencimento'),
          existe('client_payments', 'forma_pagamento'),
          existe('client_payments', 'arquivado'),
          existe('tasks', 'prioridade'),
          existe('content_cards', 'prioridade'),
        ])
      return { diaVencimento, formaPagamento, arquivado, prioridadeTarefa, prioridadeConteudo }
    },
  })
  return {
    diaVencimento: consulta.data?.diaVencimento ?? false,
    formaPagamento: consulta.data?.formaPagamento ?? false,
    arquivado: consulta.data?.arquivado ?? false,
    prioridadeTarefa: consulta.data?.prioridadeTarefa ?? false,
    prioridadeConteudo: consulta.data?.prioridadeConteudo ?? false,
    pronto: !consulta.isPending,
  }
}
