import { useState } from 'react'
import { useEdicaoInline } from '@/components/quadro/useEdicaoInline'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Campo } from '@/components/ui/Campo'
import { Drawer } from '@/components/ui/Drawer'
import { Selecao } from '@/components/ui/Selecao'
import ui from '@/components/ui/ui.module.css'
import { textoOuNull } from '@/lib/formulario'
import { COLUNAS_TAREFA, TIPOS_TAREFA } from '@/lib/rotulos'
import type { Client, Profile, Task, TaskStatus, TaskTipo } from '@/types/database'

const OPCOES_STATUS = COLUNAS_TAREFA.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))

interface TarefaDrawerProps {
  tarefa: Task
  clientes: Client[]
  perfis: Profile[]
  /** Trocar o status é mover o card: quem sabe a posição e registra a atividade é a página */
  onMover: (destino: TaskStatus) => void
  onFechar: () => void
}

/** Painel lateral da demanda. Cada campo salva sozinho: textos ao sair, seleções ao escolher. */
export function TarefaDrawer({ tarefa, clientes, perfis, onMover, onFechar }: TarefaDrawerProps) {
  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [descricao, setDescricao] = useState(tarefa.descricao ?? '')
  const [erroTitulo, setErroTitulo] = useState<string>()
  const salvar = useEdicaoInline<Task>('tasks', tarefa.id, {
    sucesso: 'Demanda atualizada.',
    erro: 'Não foi possível salvar a demanda.',
    atividade: {
      acao: 'demanda_editada',
      descricao: `editou a demanda "${tarefa.titulo}"`,
      entidade: 'tasks',
      entidadeId: tarefa.id,
    },
  })

  function salvarTitulo() {
    const limpo = titulo.trim()
    if (limpo === '') {
      setErroTitulo('Informe o título da demanda.')
      setTitulo(tarefa.titulo)
      return
    }
    setErroTitulo(undefined)
    if (limpo !== tarefa.titulo) salvar({ titulo: limpo })
  }

  function salvarDescricao() {
    const nova = textoOuNull(descricao)
    if (nova !== (tarefa.descricao ?? null)) salvar({ descricao: nova })
  }

  return (
    <Drawer aberto titulo={tarefa.titulo} onFechar={onFechar}>
      <div className={ui.formulario}>
        <Campo
          rotulo="Título"
          value={titulo}
          erro={erroTitulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          onBlur={salvarTitulo}
        />
        <AreaTexto
          rotulo="Descrição"
          placeholder="Salva ao sair do campo."
          value={descricao}
          onChange={(evento) => setDescricao(evento.target.value)}
          onBlur={salvarDescricao}
        />
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Status"
            opcoes={OPCOES_STATUS}
            value={tarefa.status}
            onChange={(evento) => onMover(evento.target.value as TaskStatus)}
          />
          <Selecao
            rotulo="Tipo"
            opcoes={TIPOS_TAREFA}
            value={tarefa.tipo}
            onChange={(evento) => salvar({ tipo: evento.target.value as TaskTipo })}
          />
        </div>
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Cliente"
            vazio="Sem cliente"
            opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            value={tarefa.client_id ?? ''}
            onChange={(evento) => salvar({ client_id: evento.target.value || null })}
          />
          <Selecao
            rotulo="Responsável"
            vazio="Sem responsável"
            opcoes={perfis.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            value={tarefa.responsavel_id ?? ''}
            onChange={(evento) => salvar({ responsavel_id: evento.target.value || null })}
          />
        </div>
        <Campo
          rotulo="Data de entrega"
          type="date"
          value={tarefa.data_entrega ?? ''}
          onChange={(evento) => salvar({ data_entrega: evento.target.value || null })}
        />
      </div>
    </Drawer>
  )
}
