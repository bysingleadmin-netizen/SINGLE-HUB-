import { createContext, useContext } from 'react'
import type { CampaignFuncao, ContentEtapa, TaskStatus } from '@/types/database'

export type Categoria = 'demanda' | 'conteudo' | 'campanha'

/** O que a tela que pediu a criação já sabe; o resto a pessoa escolhe no formulário. */
export interface PedidoDeCriacao {
  categoria?: Categoria
  /** Coluna de Demandas em que a tarefa nasce */
  status?: TaskStatus
  /** Etapa de Conteúdo em que o card nasce */
  etapa?: ContentEtapa
  campanhaId?: string
  funcao?: CampaignFuncao
}

export type AbrirCriacao = (pedido?: PedidoDeCriacao) => void

// Separado do provedor para que as telas não dependam dos formulários.
export const CriacaoContext = createContext<AbrirCriacao | null>(null)

/** Devolve a função que abre o formulário único de criação de tarefas. */
export function useCriar(): AbrirCriacao {
  const abrir = useContext(CriacaoContext)
  if (!abrir) throw new Error('useCriar precisa estar dentro de <CriacaoProvider>')
  return abrir
}
