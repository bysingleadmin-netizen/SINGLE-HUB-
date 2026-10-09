import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Icone } from '@/components/ui/Icone'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { porId, useAtualizarOtimista, useRemover, useSalvar } from '@/dados/base'
import type { Valores } from '@/dados/base'
import { STATUS_TAREFA_CAMPANHA } from '@/lib/rotulos'
import type { CampaignFuncao, CampaignTask, CampaignTaskStatus, Profile } from '@/types/database'
import { agruparPorFuncao } from './campanha'
import type { GrupoDeTarefas } from './campanha'
import styles from './campanhas.module.css'

interface GrupoProps {
  grupo: GrupoDeTarefas
  campanhaId: string
  perfis: Profile[]
}

function Grupo({ grupo, campanhaId, perfis }: GrupoProps) {
  const [titulo, setTitulo] = useState('')
  const salvar = useSalvar<CampaignTask>('campaign_tasks')
  const atualizar = useAtualizarOtimista<CampaignTask>('campaign_tasks')
  const remover = useRemover('campaign_tasks')
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()
  const perfilPorId = porId(perfis)
  const opcoesDePerfil = perfis.map((p) => ({ valor: p.id, rotulo: p.nome }))

  function aoAdicionar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = titulo.trim()
    if (limpo === '') return
    salvar.mutate(
      {
        valores: {
          campaign_id: campanhaId,
          funcao: grupo.funcao as CampaignFuncao,
          titulo: limpo,
          status: 'pendente',
        },
      },
      {
        onSuccess: (salva) => {
          toast.sucesso('Tarefa adicionada.')
          setTitulo('')
          void registrarAtividade({
            acao: 'tarefa_de_anuncio_criada',
            descricao: `criou a tarefa de anúncio "${salva.titulo}"`,
            entidade: 'campaigns',
            entidadeId: campanhaId,
          })
        },
        onError: () => toast.erro('Não foi possível adicionar a tarefa.'),
      },
    )
  }

  function atualizarTarefa(tarefa: CampaignTask, valores: Valores<CampaignTask>) {
    const concluiu = valores.status === 'concluido'
    atualizar.mutate(
      { id: tarefa.id, valores },
      {
        onSuccess: () => {
          toast.sucesso('Tarefa atualizada.')
          void registrarAtividade({
            acao: concluiu ? 'tarefa_de_anuncio_concluida' : 'tarefa_de_anuncio_editada',
            descricao: `${concluiu ? 'concluiu' : 'editou'} a tarefa de anúncio "${tarefa.titulo}"`,
            entidade: 'campaigns',
            entidadeId: campanhaId,
          })
        },
        onError: () => toast.erro('Não foi possível atualizar a tarefa.'),
      },
    )
  }

  function removerTarefa(id: string) {
    remover.mutate(id, {
      onSuccess: () => toast.sucesso('Tarefa removida.'),
      onError: () => toast.erro('Não foi possível remover a tarefa.'),
    })
  }

  return (
    <section className={styles.grupo} aria-label={grupo.rotulo}>
      <h3 className={styles.grupoTitulo}>{grupo.rotulo}</h3>

      {grupo.tarefas.length === 0 ? (
        <p className={ui.mudo}>Nenhuma tarefa.</p>
      ) : (
        <ul className={ui.lista}>
          {grupo.tarefas.map((tarefa) => (
            <li key={tarefa.id} className={`${ui.linha} ${styles.tarefa}`}>
              <span
                className={styles.tarefaTitulo}
                data-concluida={tarefa.status === 'concluido' || undefined}
              >
                {tarefa.titulo}
              </span>
              <Selecao
                rotulo={`Status de ${tarefa.titulo}`}
                ocultarRotulo
                opcoes={STATUS_TAREFA_CAMPANHA}
                value={tarefa.status}
                onChange={(evento) =>
                  atualizarTarefa(tarefa, { status: evento.target.value as CampaignTaskStatus })
                }
              />
              <Selecao
                rotulo={`Responsável por ${tarefa.titulo}`}
                ocultarRotulo
                vazio="Sem responsável"
                opcoes={opcoesDePerfil}
                value={
                  tarefa.responsavel_id && perfilPorId.has(tarefa.responsavel_id)
                    ? tarefa.responsavel_id
                    : ''
                }
                onChange={(evento) =>
                  atualizarTarefa(tarefa, { responsavel_id: evento.target.value || null })
                }
              />
              <button
                type="button"
                className={ui.botaoIcone}
                aria-label={`Remover ${tarefa.titulo}`}
                title="Remover"
                onClick={() => removerTarefa(tarefa.id)}
              >
                <Icone nome="lixeira" tamanho={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.novaTarefa} onSubmit={aoAdicionar}>
        <input
          className={ui.campoInput}
          aria-label={`Nova tarefa de ${grupo.rotulo}`}
          placeholder="Nova tarefa"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
        />
        <Button type="submit" variante="secundario" carregando={salvar.isPending}>
          Adicionar
        </Button>
      </form>
    </section>
  )
}

interface TarefasDaCampanhaProps {
  campanhaId: string
  tarefas: CampaignTask[]
  perfis: Profile[]
}

/** Tarefas da campanha separadas por função, cada uma com status e responsável. */
export function TarefasDaCampanha({ campanhaId, tarefas, perfis }: TarefasDaCampanhaProps) {
  return (
    <div className={styles.grupos}>
      {agruparPorFuncao(tarefas, campanhaId).map((grupo) => (
        <Grupo key={grupo.funcao} grupo={grupo} campanhaId={campanhaId} perfis={perfis} />
      ))}
    </div>
  )
}
