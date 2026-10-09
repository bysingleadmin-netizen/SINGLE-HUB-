import { useCallback, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useRegistrarAtividade } from '@/dados/atividade'
import type { Registro } from '@/dados/atividade'
import { useAtualizarOtimista } from '@/dados/base'
import type { Tabela, Valores } from '@/dados/base'
import { proximaPosicao } from './colunas'
import type { ItemQuadro } from './colunas'

interface ConfigMover<T> {
  tabela: Tabela
  /** Coluna do banco que guarda em que coluna do quadro o card está */
  campo: keyof T & string
  sucesso: (item: T, destino: string) => string
  erro: string
  /** O que gravar no registro de atividade; null para não registrar */
  atividade: (item: T, destino: string) => Registro | null
}

/**
 * Move um card para o fim de outra coluna. A tela muda na hora e volta atrás
 * se o banco recusar.
 */
export function useMover<T extends ItemQuadro>(config: ConfigMover<T>) {
  const { mutate } = useAtualizarOtimista<T>(config.tabela)
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()
  const atual = useRef(config)
  atual.current = config

  return useCallback(
    (item: T, destino: string, itens: T[]) => {
      const { campo, sucesso, erro, atividade } = atual.current
      const vizinhos = itens.filter((outro) => outro[campo] === destino && outro.id !== item.id)
      const valores = { [campo]: destino, posicao: proximaPosicao(vizinhos) } as Valores<T>
      mutate(
        { id: item.id, valores },
        {
          onSuccess: () => {
            toast.sucesso(sucesso(item, destino))
            const registro = atividade(item, destino)
            if (registro) void registrarAtividade(registro)
          },
          onError: () => toast.erro(erro),
        },
      )
    },
    [mutate, registrarAtividade, toast],
  )
}
