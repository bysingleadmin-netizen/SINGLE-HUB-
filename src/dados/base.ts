import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Tabela =
  | 'profiles'
  | 'clients'
  | 'client_payments'
  | 'tasks'
  | 'content_cards'
  | 'campaigns'
  | 'campaign_tasks'
  | 'calendar_events'
  | 'event_participants'
  | 'expenses'
  | 'monthly_goals'
  | 'traffic_metrics'
  | 'task_comments'
  | 'board_columns'

interface ComId {
  id: string
}

export type Valores<T> = Partial<Omit<T, 'id' | 'created_at'>>

interface OpcoesDeLista {
  /** false adia a consulta (tabelas que só a liderança pode ler) */
  ativo?: boolean
  /** Coluna de ordenação; null para tabelas sem created_at */
  ordenarPor?: string | null
}

/** Lista a tabela inteira, por padrão da linha mais antiga para a mais nova. */
export function useLista<T>(
  tabela: Tabela,
  { ativo = true, ordenarPor = 'created_at' }: OpcoesDeLista = {},
) {
  return useQuery({
    queryKey: [tabela],
    enabled: ativo,
    queryFn: async () => {
      const consulta = supabase.from(tabela).select('*')
      const { data, error } = await (ordenarPor
        ? consulta.order(ordenarPor, { ascending: true })
        : consulta)
      if (error) throw error
      return (data ?? []) as T[]
    },
  })
}

/** Cria (sem id) ou atualiza (com id) uma linha e devolve o resultado. */
export function useSalvar<T extends ComId>(tabela: Tabela) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, valores }: { id?: string; valores: Valores<T> }) => {
      const consulta = id
        ? supabase.from(tabela).update(valores as Record<string, unknown>).eq('id', id)
        : supabase.from(tabela).insert(valores as Record<string, unknown>)
      const { data, error } = await consulta.select().single()
      if (error) throw error
      return data as T
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [tabela] }),
  })
}

/**
 * Atualiza uma linha mostrando o resultado na hora e desfazendo se o banco recusar.
 * Usado ao arrastar cards e em edições rápidas de um campo.
 */
export function useAtualizarOtimista<T extends ComId>(tabela: Tabela) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, valores }: { id: string; valores: Valores<T> }) => {
      const { error } = await supabase.from(tabela).update(valores as Record<string, unknown>).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, valores }) => {
      await queryClient.cancelQueries({ queryKey: [tabela] })
      const anterior = queryClient.getQueryData<T[]>([tabela])
      queryClient.setQueryData<T[]>([tabela], (lista) =>
        lista?.map((linha) => (linha.id === id ? { ...linha, ...valores } : linha)),
      )
      return { anterior }
    },
    onError: (_erro, _variaveis, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData([tabela], contexto.anterior)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [tabela] }),
  })
}

export function useRemover(tabela: Tabela) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tabela).delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: [tabela] }),
  })
}

/** Indexa uma lista por id para fazer junções no cliente. */
export function porId<T extends ComId>(lista: T[] | undefined): Map<string, T> {
  return new Map((lista ?? []).map((item) => [item.id, item]))
}

/** Estado conjunto de várias consultas de uma tela: carregando, erro e uma ação de tentar de novo. */
export function juntarConsultas(...consultas: UseQueryResult<unknown>[]) {
  return {
    carregando: consultas.some((c) => c.isLoading),
    erro: consultas.some((c) => c.isError),
    tentar: () => {
      for (const consulta of consultas) if (consulta.isError) void consulta.refetch()
    },
  }
}
