import { useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useAtualizarOtimista } from '@/dados/base'
import type { Tabela, Valores } from '@/dados/base'

interface Mensagens {
  sucesso: string
  erro: string
}

/**
 * Salva um campo por vez, como fazem os painéis laterais do quadro.
 * A tela muda na hora e volta atrás se o banco recusar.
 */
export function useEdicaoInline<T extends { id: string }>(
  tabela: Tabela,
  id: string,
  { sucesso, erro }: Mensagens,
) {
  const { mutate } = useAtualizarOtimista<T>(tabela)
  const toast = useToast()

  return useCallback(
    (valores: Valores<T>) => {
      mutate(
        { id, valores },
        { onSuccess: () => toast.sucesso(sucesso), onError: () => toast.erro(erro) },
      )
    },
    [mutate, toast, id, sucesso, erro],
  )
}
