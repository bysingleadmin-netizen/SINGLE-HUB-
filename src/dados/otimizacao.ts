import { useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { hojeISO } from '@/lib/datas'
import { dataAposOtimizar } from '@/lib/regras'
import type { Campaign } from '@/types/database'
import { useRegistrarAtividade } from './atividade'
import { useAtualizarOtimista } from './base'

/** Registra a otimização de uma campanha: a próxima fica para dali a dois dias. */
export function useRegistrarOtimizacao() {
  const { mutate, isPending } = useAtualizarOtimista<Campaign>('campaigns')
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  const registrar = useCallback(
    (campanha: Pick<Campaign, 'id' | 'nome'>) => {
      mutate(
        { id: campanha.id, valores: { proxima_otimizacao: dataAposOtimizar(hojeISO()) } },
        {
          onSuccess: () => {
            toast.sucesso('Otimização registrada.')
            void registrarAtividade({
              acao: 'otimizacao_registrada',
              descricao: `registrou a otimização do anúncio "${campanha.nome}"`,
              entidade: 'campaigns',
              entidadeId: campanha.id,
            })
          },
          onError: () => toast.erro('Não foi possível registrar a otimização.'),
        },
      )
    },
    [mutate, registrarAtividade, toast],
  )

  return { registrar, registrando: isPending }
}
