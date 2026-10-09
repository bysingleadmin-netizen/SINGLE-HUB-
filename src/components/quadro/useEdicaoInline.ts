import { useCallback, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useRegistrarAtividade } from '@/dados/atividade'
import type { Registro } from '@/dados/atividade'
import { useAtualizarOtimista } from '@/dados/base'
import type { Tabela, Valores } from '@/dados/base'

interface Mensagens {
  sucesso: string
  erro: string
  /** O que gravar no registro de atividade quando a pessoa edita o item */
  atividade?: Registro
}

/**
 * Salva um campo por vez, como fazem os painéis laterais do quadro.
 * A tela muda na hora e volta atrás se o banco recusar.
 * A edição entra no registro de atividade uma vez por abertura do painel, não a cada campo.
 */
export function useEdicaoInline<T extends { id: string }>(
  tabela: Tabela,
  id: string,
  { sucesso, erro, atividade }: Mensagens,
) {
  const { mutate } = useAtualizarOtimista<T>(tabela)
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()
  const registrada = useRef(false)
  const registro = useRef(atividade)
  registro.current = atividade

  return useCallback(
    (valores: Valores<T>) => {
      mutate(
        { id, valores },
        {
          onSuccess: () => {
            toast.sucesso(sucesso)
            if (registro.current && !registrada.current) {
              registrada.current = true
              void registrarAtividade(registro.current)
            }
          },
          onError: () => toast.erro(erro),
        },
      )
    },
    [mutate, toast, registrarAtividade, id, sucesso, erro],
  )
}
