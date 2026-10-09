import { useCallback, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useAtualizarOtimista } from '@/dados/base'
import type { Tabela, Valores } from '@/dados/base'
import type { SituacaoDoCard } from '@/types/database'
import type { ItemQuadro } from './colunas'

interface ConfigSituacao<T> {
  tabela: Tabela
  /** Coluna do quadro em que o card está */
  colunaDe: (item: T) => string
  colunas: readonly { id: string }[]
  /** Move o card; o último argumento vai junto na mesma gravação */
  mover: (item: T, destino: string, itens: T[], extras?: Valores<T>) => void
  /** Se o banco já tem a coluna `situacao` (migration 0003) */
  disponivel: boolean
}

/**
 * Menu de status do card: Travado, Em andamento e Feito.
 *
 * "Feito" quer dizer que o trabalho desta coluna acabou: o card anda sozinho para a coluna
 * seguinte e chega lá sem status, porque naquela etapa ele ainda não começou. Na última
 * coluna não há para onde andar, então o card fica marcado como Feito.
 */
export function useSituacao<T extends ItemQuadro & { situacao?: SituacaoDoCard | null }>(
  config: ConfigSituacao<T>,
) {
  const { mutate } = useAtualizarOtimista<T>(config.tabela)
  const toast = useToast()
  const atual = useRef(config)
  atual.current = config

  return useCallback(
    (item: T, situacao: SituacaoDoCard | null, itens: T[]) => {
      const { colunaDe, colunas, mover, disponivel } = atual.current
      if (situacao === 'feito') {
        const seguinte = colunas[colunas.findIndex((coluna) => coluna.id === colunaDe(item)) + 1]
        if (seguinte) {
          mover(item, seguinte.id, itens, disponivel ? ({ situacao: null } as Valores<T>) : undefined)
          return
        }
      }
      if (!disponivel) {
        toast.erro(
          situacao === 'feito'
            ? 'O card já está na última coluna.'
            : 'Para marcar como Travado ou Em andamento, rode a migration 0003 no Supabase.',
        )
        return
      }
      mutate(
        { id: item.id, valores: { situacao } as Valores<T> },
        {
          onSuccess: () => toast.sucesso('Status atualizado.'),
          onError: () => toast.erro('Não foi possível atualizar o status.'),
        },
      )
    },
    [mutate, toast],
  )
}
