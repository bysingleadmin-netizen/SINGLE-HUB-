import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CardInfo } from '@/components/quadro/CardInfo'
import { Quadro } from '@/components/quadro/Quadro'
import quadro from '@/components/quadro/pagina.module.css'
import { useMover } from '@/components/quadro/useMover'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { juntarConsultas, porId } from '@/dados/base'
import { useClientes, usePerfis, useTarefas } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { situacaoDoPrazo, tarefaAberta, tarefaAtrasada } from '@/lib/regras'
import { COLUNAS_TAREFA, TIPOS_TAREFA, opcao } from '@/lib/rotulos'
import type { Task, TaskStatus, TaskTipo } from '@/types/database'
import { TarefaDrawer } from './TarefaDrawer'
import { TarefaModal, tituloDoStatus } from './TarefaModal'
import { filtrarTarefas } from './tarefa'


export function DemandasPage() {
  const tarefas = useTarefas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const [tipo, setTipo] = useState<TaskTipo | ''>('')
  const [responsavel, setResponsavel] = useState('')
  /** Coluna em que o modal de nova demanda abre; undefined quando fechado */
  const [criandoEm, setCriandoEm] = useState<TaskStatus>()
  // A demanda aberta fica no endereço, para a busca e as notificações levarem direto a ela
  const [parametros, setParametros] = useSearchParams()
  const abertaId = parametros.get('abrir')

  const mover = useMover<Task>({
    tabela: 'tasks',
    campo: 'status',
    sucesso: (_tarefa, destino) =>
      destino === 'arquivado'
        ? 'Demanda arquivada.'
        : `Demanda movida para ${tituloDoStatus(destino)}.`,
    erro: 'Não foi possível mover a demanda.',
    atividade: (tarefa, destino) =>
      destino === 'arquivado'
        ? null
        : {
            acao: 'demanda_movida',
            descricao: `moveu a demanda "${tarefa.titulo}" para ${tituloDoStatus(destino)}`,
            entidade: 'tasks',
            entidadeId: tarefa.id,
          },
  })

  const consultas = juntarConsultas(tarefas, clientes, perfis)
  const todas = tarefas.data ?? []
  const noQuadro = todas.filter((tarefa) => tarefa.status !== 'arquivado')
  const visiveis = filtrarTarefas(noQuadro, { tipo, responsavel })
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const hoje = hojeISO()
  const aberta = todas.find((t) => t.id === abertaId)
  const fecharPainel = () => setParametros({}, { replace: true })

  return (
    <div className={quadro.pagina}>
      <div className={quadro.barra}>
        <div className={quadro.filtros}>
          <Selecao
            rotulo="Tipo"
            vazio="Todos os tipos"
            opcoes={TIPOS_TAREFA}
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as TaskTipo | '')}
          />
          <Selecao
            rotulo="Responsável"
            vazio="Toda a equipe"
            opcoes={(perfis.data ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))}
            value={responsavel}
            onChange={(evento) => setResponsavel(evento.target.value)}
          />
        </div>
        <Button onClick={() => setCriandoEm('a_fazer')}>
          <Icone nome="mais" tamanho={16} />
          Nova demanda
        </Button>
      </div>

      {consultas.erro ? (
        <EstadoErro onTentar={consultas.tentar} />
      ) : consultas.carregando ? (
        <div className={quadro.carregando} aria-busy="true">
          {COLUNAS_TAREFA.map((coluna) => (
            <Skeleton key={coluna.id} altura="220px" raio="var(--radius)" />
          ))}
        </div>
      ) : (
        <>
          {noQuadro.length === 0 ? (
            <EstadoVazio
              ilustracao="quadro" titulo="Nenhuma demanda ainda."
              texto="Use Nova demanda ou o botão de adicionar de uma coluna para criar a primeira."
            />
          ) : (
            visiveis.length === 0 && <EstadoVazio ilustracao="busca" titulo="Nenhuma demanda com esses filtros." />
          )}
          <Quadro
            colunas={COLUNAS_TAREFA}
            itens={visiveis}
            colunaDe={(tarefa) => tarefa.status}
            tituloDe={(tarefa) => tarefa.titulo}
            atrasado={(tarefa) => tarefaAtrasada(tarefa, hoje)}
            renderCard={(tarefa) => {
              const tipoDaTarefa = opcao(TIPOS_TAREFA, tarefa.tipo)
              return (
                <CardInfo
                  titulo={tarefa.titulo}
                  etiqueta={<Pill tom={tipoDaTarefa.tom}>{tipoDaTarefa.rotulo}</Pill>}
                  cliente={tarefa.client_id ? clientePorId.get(tarefa.client_id) : undefined}
                  responsavel={
                    tarefa.responsavel_id ? perfilPorId.get(tarefa.responsavel_id) : undefined
                  }
                  dataEntrega={tarefa.data_entrega}
                  prazo={situacaoDoPrazo(tarefa.data_entrega, hoje, !tarefaAberta(tarefa))}
                />
              )
            }}
            onMover={(tarefa, destino) => mover(tarefa, destino, todas)}
            onArquivar={(tarefa) => mover(tarefa, 'arquivado', todas)}
            onCriar={(status) => setCriandoEm(status as TaskStatus)}
            onAbrir={(tarefa) => setParametros({ abrir: tarefa.id }, { replace: true })}
          />
        </>
      )}

      {criandoEm && (
        <TarefaModal
          statusInicial={criandoEm}
          tarefas={todas}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          onFechar={() => setCriandoEm(undefined)}
        />
      )}
      {aberta && (
        <TarefaDrawer
          key={aberta.id}
          tarefa={aberta}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          onMover={(destino) => mover(aberta, destino, todas)}
          onFechar={fecharPainel}
        />
      )}
    </div>
  )
}
