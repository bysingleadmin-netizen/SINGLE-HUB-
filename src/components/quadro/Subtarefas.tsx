import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Icone } from '@/components/ui/Icone'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useAtualizarOtimista, useRemover, useSalvar } from '@/dados/base'
import { resumir } from '@/dados/subtarefas'
import type { CardSubtarefa, QuadroId } from '@/types/database'
import styles from './opcoes.module.css'

interface SubtarefasProps {
  quadro: QuadroId
  cardId: string
  subtarefas: CardSubtarefa[]
}

/**
 * Lista de subtarefas do card: caixa de marcar e texto. Concluir todas não muda o status
 * do card nem o move; só troca o indicador para "tudo concluído".
 */
export function Subtarefas({ quadro, cardId, subtarefas }: SubtarefasProps) {
  const [titulo, setTitulo] = useState('')
  const criar = useSalvar<CardSubtarefa>('card_subtarefas')
  const atualizar = useAtualizarOtimista<CardSubtarefa>('card_subtarefas')
  const remover = useRemover('card_subtarefas')
  const toast = useToast()
  const resumo = resumir(subtarefas)

  function aoCriar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = titulo.trim()
    if (limpo === '') return
    criar.mutate(
      {
        valores: {
          quadro,
          card_id: cardId,
          titulo: limpo,
          concluida: false,
          posicao: subtarefas.reduce((maior, s) => Math.max(maior, s.posicao), 0) + 1,
        },
      },
      {
        onSuccess: () => setTitulo(''),
        onError: () => toast.erro('Não foi possível criar a subtarefa.'),
      },
    )
  }

  function alternar(subtarefa: CardSubtarefa) {
    atualizar.mutate(
      { id: subtarefa.id, valores: { concluida: !subtarefa.concluida } },
      { onError: () => toast.erro('Não foi possível atualizar a subtarefa.') },
    )
  }

  function excluir(subtarefa: CardSubtarefa) {
    remover.mutate(subtarefa.id, {
      onError: () => toast.erro('Não foi possível remover a subtarefa.'),
    })
  }

  return (
    <>
      {resumo.total > 0 && (
        <div className={styles.progresso} data-completo={resumo.completo || undefined}>
          {resumo.completo && <Icone nome="confirmar" tamanho={16} />}
          <span>
            {resumo.completo
              ? 'Todas as subtarefas concluídas'
              : `${resumo.feitas} de ${resumo.total} concluídas`}
          </span>
          <span className={styles.progressoBarra} aria-hidden="true">
            <span style={{ width: `${(resumo.feitas / resumo.total) * 100}%` }} />
          </span>
        </div>
      )}

      {subtarefas.length === 0 ? (
        <p className={ui.mudo}>Nenhuma subtarefa ainda.</p>
      ) : (
        <ul className={styles.subtarefas}>
          {subtarefas.map((subtarefa) => (
            <li
              key={subtarefa.id}
              className={styles.subtarefa}
              data-concluida={subtarefa.concluida || undefined}
            >
              <label>
                <input
                  type="checkbox"
                  checked={subtarefa.concluida}
                  onChange={() => alternar(subtarefa)}
                />
                {subtarefa.titulo}
              </label>
              <button
                type="button"
                className={ui.botaoIcone}
                aria-label={`Remover subtarefa ${subtarefa.titulo}`}
                title="Remover"
                onClick={() => excluir(subtarefa)}
              >
                <Icone nome="lixeira" tamanho={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.nova} onSubmit={aoCriar}>
        <input
          className={ui.campoInput}
          aria-label="Nova subtarefa"
          placeholder="Nova subtarefa"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
        />
        <Button type="submit" variante="secundario" carregando={criar.isPending}>
          Adicionar
        </Button>
      </form>
    </>
  )
}
