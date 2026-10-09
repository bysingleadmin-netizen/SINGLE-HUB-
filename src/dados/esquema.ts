import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Códigos que o Postgres e a API devolvem quando a coluna pedida não existe
const COLUNA_AUSENTE = new Set(['42703', 'PGRST204'])

async function existe(tabela: 'clients' | 'client_payments', coluna: string): Promise<boolean> {
  const { error } = await supabase.from(tabela).select(coluna).limit(0)
  if (!error) return true
  if (COLUNA_AUSENTE.has(error.code)) return false
  throw error
}

/**
 * Diz se o banco já recebeu a migration 0002 (dia de vencimento no cliente e forma de
 * pagamento no pagamento). O app funciona sem ela; estas colunas só acrescentam detalhe.
 * Enquanto a checagem não termina, `pronto` vem false e as duas colunas contam como ausentes.
 */
export function useColunasOpcionais() {
  const consulta = useQuery({
    queryKey: ['esquema'],
    staleTime: Infinity,
    queryFn: async () => ({
      diaVencimento: await existe('clients', 'dia_vencimento'),
      formaPagamento: await existe('client_payments', 'forma_pagamento'),
    }),
  })
  return {
    diaVencimento: consulta.data?.diaVencimento ?? false,
    formaPagamento: consulta.data?.formaPagamento ?? false,
    pronto: !consulta.isPending,
  }
}
