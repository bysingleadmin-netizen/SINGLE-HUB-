import { useState } from 'react'
import type { FormEvent } from 'react'
import { proximaPosicao } from '@/components/quadro/colunas'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useSalvar } from '@/dados/base'
import { useAuth } from '@/features/auth/AuthContext'
import type { Erros } from '@/lib/formulario'
import { COLUNAS_TAREFA, TIPOS_TAREFA } from '@/lib/rotulos'
import type { Client, Profile, Task, TaskStatus, TaskTipo } from '@/types/database'
import { formDaTarefa, formNovaTarefa, validarTarefa } from './tarefa'
import type { FormTarefa } from './tarefa'

const OPCOES_STATUS = COLUNAS_TAREFA.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))

export function tituloDoStatus(status: string): string {
  return COLUNAS_TAREFA.find((coluna) => coluna.id === status)?.titulo ?? status
}

interface TarefaModalProps {
  /** Demanda em edição; sem ela, o modal cria uma nova em `statusInicial` */
  tarefa?: Task
  statusInicial?: TaskStatus
  tarefas: Task[]
  clientes: Client[]
  perfis: Profile[]
  onFechar: () => void
}

export function TarefaModal({
  tarefa,
  statusInicial = 'a_fazer',
  tarefas,
  clientes,
  perfis,
  onFechar,
}: TarefaModalProps) {
  const { perfil } = useAuth()
  const [form, setForm] = useState<FormTarefa>(() =>
    tarefa ? formDaTarefa(tarefa) : formNovaTarefa(statusInicial),
  )
  const [erros, setErros] = useState<Erros<FormTarefa>>({})
  const salvar = useSalvar<Task>('tasks')
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  function mudar<C extends keyof FormTarefa>(campo: C, valor: FormTarefa[C]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarTarefa(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    setErros({})
    const { valores } = resultado
    const mudouDeColuna = !tarefa || tarefa.status !== valores.status
    // Quem entra em uma coluna vai para o fim dela
    const posicao = mudouDeColuna
      ? proximaPosicao(tarefas.filter((t) => t.status === valores.status && t.id !== tarefa?.id))
      : tarefa.posicao

    salvar.mutate(
      {
        id: tarefa?.id,
        valores: tarefa
          ? { ...valores, posicao }
          : { ...valores, posicao, created_by: perfil?.id ?? null },
      },
      {
        onSuccess: (salva) => {
          toast.sucesso(tarefa ? 'Demanda atualizada.' : 'Demanda criada.')
          if (!tarefa) {
            void registrarAtividade({
              acao: 'demanda_criada',
              descricao: `criou a demanda "${salva.titulo}"`,
              entidade: 'tasks',
              entidadeId: salva.id,
            })
          } else if (mudouDeColuna) {
            void registrarAtividade({
              acao: 'demanda_movida',
              descricao: `moveu a demanda "${salva.titulo}" para ${tituloDoStatus(salva.status)}`,
              entidade: 'tasks',
              entidadeId: salva.id,
            })
          }
          onFechar()
        },
        onError: () => toast.erro('Não foi possível salvar a demanda.'),
      },
    )
  }

  return (
    <Modal aberto titulo={tarefa ? 'Editar demanda' : 'Nova demanda'} onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <Campo
          rotulo="Título"
          autoFocus
          value={form.titulo}
          erro={erros.titulo}
          onChange={(evento) => mudar('titulo', evento.target.value)}
        />
        <AreaTexto
          rotulo="Descrição"
          rows={3}
          value={form.descricao}
          onChange={(evento) => mudar('descricao', evento.target.value)}
        />
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Cliente"
            vazio="Sem cliente"
            opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            value={form.client_id}
            onChange={(evento) => mudar('client_id', evento.target.value)}
          />
          <Selecao
            rotulo="Responsável"
            vazio="Sem responsável"
            opcoes={perfis.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            value={form.responsavel_id}
            onChange={(evento) => mudar('responsavel_id', evento.target.value)}
          />
        </div>
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Tipo"
            opcoes={TIPOS_TAREFA}
            value={form.tipo}
            onChange={(evento) => mudar('tipo', evento.target.value as TaskTipo)}
          />
          <Selecao
            rotulo="Status"
            opcoes={OPCOES_STATUS}
            value={form.status}
            onChange={(evento) => mudar('status', evento.target.value as TaskStatus)}
          />
        </div>
        <Campo
          rotulo="Data de entrega"
          type="date"
          value={form.data_entrega}
          onChange={(evento) => mudar('data_entrega', evento.target.value)}
        />
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={salvar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
