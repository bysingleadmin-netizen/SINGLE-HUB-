import { useState } from 'react'
import { Anexos } from '@/components/quadro/Anexos'
import styles from '@/components/quadro/detalhe.module.css'
import { useEdicaoInline } from '@/components/quadro/useEdicaoInline'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Campo } from '@/components/ui/Campo'
import { Drawer } from '@/components/ui/Drawer'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import type { ColunaDoQuadro } from '@/dados/colunas'
import { useColunasOpcionais } from '@/dados/esquema'
import { hojeISO } from '@/lib/datas'
import { formatarData } from '@/lib/formato'
import { textoOuNull } from '@/lib/formulario'
import { opcoesDePessoas } from '@/lib/pessoas'
import { descreverPrazo, situacaoDoPrazo, tarefaAberta } from '@/lib/regras'
import { PRIORIDADES, TIPOS_TAREFA, opcao } from '@/lib/rotulos'
import type {
  CardAttachment,
  Client,
  Prioridade,
  Profile,
  Task,
  TaskStatus,
  TaskTipo,
} from '@/types/database'
import { Comentarios } from './Comentarios'

interface TarefaDrawerProps {
  tarefa: Task
  clientes: Client[]
  perfis: Profile[]
  /** Colunas do quadro, com os nomes que a equipe deu */
  colunas: readonly ColunaDoQuadro[]
  /** undefined quando o banco ainda não tem a tabela de anexos */
  anexos?: CardAttachment[]
  /** Trocar o status é mover o card: quem sabe a posição e registra a atividade é a página */
  onMover: (destino: TaskStatus) => void
  onFechar: () => void
}

/** Painel lateral da demanda. Cada campo salva sozinho: textos ao sair, seleções ao escolher. */
export function TarefaDrawer({
  tarefa,
  clientes,
  perfis,
  colunas,
  anexos,
  onMover,
  onFechar,
}: TarefaDrawerProps) {
  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [descricao, setDescricao] = useState(tarefa.descricao ?? '')
  const [erroTitulo, setErroTitulo] = useState<string>()
  const esquema = useColunasOpcionais()
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

  const hoje = hojeISO()
  const entregue = !tarefaAberta(tarefa)
  const tipo = opcao(TIPOS_TAREFA, tarefa.tipo)
  const prioridade = opcao(PRIORIDADES, tarefa.prioridade ?? 'media')
  const criador = perfis.find((p) => p.id === tarefa.created_by)

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
      <div className={styles.detalhe}>
        <div className={styles.resumo}>
          <Pill tom={tipo.tom}>{tipo.rotulo}</Pill>
          {esquema.prioridadeTarefa && <Pill tom={prioridade.tom}>Prioridade {prioridade.rotulo}</Pill>}
          <span
            className={styles.prazo}
            data-prazo={situacaoDoPrazo(tarefa.data_entrega, hoje, entregue) ?? undefined}
          >
            <Icone nome="calendario" tamanho={14} />
            {descreverPrazo(tarefa.data_entrega, hoje, entregue)}
          </span>
        </div>

        <Campo
          className={styles.titulo}
          rotulo="Título"
          value={titulo}
          erro={erroTitulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          onBlur={salvarTitulo}
        />

        <section className={styles.bloco} aria-label="Detalhes">
          <h3 className={styles.blocoTitulo}>Detalhes</h3>
          <div className={styles.propriedades}>
            <Selecao
              rotulo="Status"
              opcoes={colunas.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))}
              value={tarefa.status}
              onChange={(evento) => onMover(evento.target.value as TaskStatus)}
            />
            <Selecao
              rotulo="Tipo"
              opcoes={TIPOS_TAREFA}
              value={tarefa.tipo}
              onChange={(evento) => salvar({ tipo: evento.target.value as TaskTipo })}
            />
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
              opcoes={opcoesDePessoas(perfis)}
              value={tarefa.responsavel_id ?? ''}
              onChange={(evento) => salvar({ responsavel_id: evento.target.value || null })}
            />
            <Campo
              rotulo="Data de entrega"
              type="date"
              value={tarefa.data_entrega ?? ''}
              onChange={(evento) => salvar({ data_entrega: evento.target.value || null })}
            />
            {esquema.prioridadeTarefa && (
              <Selecao
                rotulo="Prioridade"
                opcoes={PRIORIDADES}
                value={tarefa.prioridade ?? 'media'}
                onChange={(evento) => salvar({ prioridade: evento.target.value as Prioridade })}
              />
            )}
          </div>
        </section>

        <section className={styles.bloco} aria-label="Descrição da demanda">
          <AreaTexto
            rotulo="Descrição"
            placeholder="Salva ao sair do campo."
            value={descricao}
            onChange={(evento) => setDescricao(evento.target.value)}
            onBlur={salvarDescricao}
          />
        </section>

        {anexos && (
          <section className={styles.bloco} aria-label="Anexos">
            <h3 className={styles.blocoTitulo}>Anexos</h3>
            <Anexos quadro="demandas" cardId={tarefa.id} anexos={anexos} />
          </section>
        )}

        <Comentarios tarefaId={tarefa.id} perfis={perfis} />

        <p className={styles.rodape}>
          Criada em {formatarData(tarefa.created_at)}
          {criador && ` por ${criador.nome}`}
        </p>
      </div>
    </Drawer>
  )
}
