import { useState } from 'react'
import type { FormEvent } from 'react'
import { proximaPosicao } from '@/components/quadro/colunas'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useSalvar } from '@/dados/base'
import { useNotificar } from '@/dados/notificacoes'
import { useClientes, usePerfis, useTarefas } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { formNovaTarefa, validarTarefa } from '@/features/demandas/tarefa'
import type { FormTarefa } from '@/features/demandas/tarefa'
import type { Erros } from '@/lib/formulario'
import { COLUNAS_TAREFA, TIPOS_TAREFA } from '@/lib/rotulos'
import type { Task, TaskStatus, TaskTipo } from '@/types/database'

const OPCOES_STATUS = COLUNAS_TAREFA.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))

interface FormDemandaProps {
  /** Coluna em que a demanda nasce */
  statusInicial: TaskStatus
  onFechar: () => void
}

/** Campos e gravação de uma demanda nova. Para editar, o quadro abre o TarefaDrawer. */
export function FormDemanda({ statusInicial, onFechar }: FormDemandaProps) {
  const { perfil } = useAuth()
  const tarefas = useTarefas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const [form, setForm] = useState<FormTarefa>(() => formNovaTarefa(statusInicial))
  const [erros, setErros] = useState<Erros<FormTarefa>>({})
  const salvar = useSalvar<Task>('tasks')
  const registrarAtividade = useRegistrarAtividade()
  const notificar = useNotificar()
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
    // A demanda nova entra no fim da coluna
    const posicao = proximaPosicao((tarefas.data ?? []).filter((t) => t.status === valores.status))

    salvar.mutate(
      { valores: { ...valores, posicao, created_by: perfil?.id ?? null } },
      {
        onSuccess: (salva) => {
          toast.sucesso('Demanda criada.')
          void registrarAtividade({
            acao: 'demanda_criada',
            descricao: `criou a demanda "${salva.titulo}"`,
            entidade: 'tasks',
            entidadeId: salva.id,
          })
          void notificar([salva.responsavel_id], {
            tipo: 'tarefa',
            titulo: 'Nova demanda para você',
            mensagem: `${perfil?.nome ?? 'Alguém'} atribuiu a demanda "${salva.titulo}" a você.`,
            link: `/app/demandas?abrir=${salva.id}`,
          })
          onFechar()
        },
        onError: () => toast.erro('Não foi possível salvar a demanda.'),
      },
    )
  }

  return (
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
          opcoes={(clientes.data ?? []).map((c) => ({ valor: c.id, rotulo: c.nome }))}
          value={form.client_id}
          onChange={(evento) => mudar('client_id', evento.target.value)}
        />
        <Selecao
          rotulo="Responsável"
          vazio="Sem responsável"
          opcoes={(perfis.data ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))}
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
  )
}
