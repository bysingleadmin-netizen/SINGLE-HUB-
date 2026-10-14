import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlternarVisao, useVisao } from '@/components/quadro/AlternarVisao'
import { Arquivados } from '@/components/quadro/Arquivados'
import { AvisoDeMigracao } from '@/components/quadro/AvisoDeMigracao'
import { CardInfo } from '@/components/quadro/CardInfo'
import { FiltroDeColaboradores } from '@/components/quadro/FiltroDeColaboradores'
import { Quadro } from '@/components/quadro/Quadro'
import { RodapeDoCard } from '@/components/quadro/RodapeDoCard'
import { TabelaDeTarefas } from '@/components/quadro/TabelaDeTarefas'
import type { ColunaDaTabela } from '@/components/quadro/TabelaDeTarefas'
import { CelulaCliente, CelulaPessoa, CelulaPrazo, CelulaTitulo } from '@/components/quadro/celulas'
import { datasDoCiclo, venceuOPrazoVisivel } from '@/components/quadro/ciclo'
import { progressoNoQuadro } from '@/components/quadro/colunas'
import quadro from '@/components/quadro/pagina.module.css'
import { useMover } from '@/components/quadro/useMover'
import { useSituacao } from '@/components/quadro/useSituacao'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAnexos } from '@/dados/anexos'
import { juntarConsultas, porId } from '@/dados/base'
import { useColunasDoQuadro } from '@/dados/colunas'
import { useComentarios } from '@/dados/comentarios'
import { useColunasOpcionais } from '@/dados/esquema'
import { useOpcoes } from '@/dados/opcoes'
import { resumir, useSubtarefas } from '@/dados/subtarefas'
import { useClientes, usePerfis, useTarefas } from '@/dados/tabelas'
import { useCriar } from '@/features/criar/CriacaoContext'
import { hojeISO } from '@/lib/datas'
import { situacaoDoPrazo, tarefaAberta, tarefaAtrasada } from '@/lib/regras'
import { COLUNAS_TAREFA, PRIORIDADES, SITUACOES, TIPOS_TAREFA, opcao } from '@/lib/rotulos'
import type { Task, TaskStatus, TaskTipo } from '@/types/database'
import { TarefaDrawer } from './TarefaDrawer'
import { filtrarTarefas } from './tarefa'

export function DemandasPage() {
  const tarefas = useTarefas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const criar = useCriar()
  const esquema = useColunasOpcionais()
  const comentarios = useComentarios()
  const anexos = useAnexos('demandas')
  const subtarefas = useSubtarefas('demandas')
  const situacoes = useOpcoes('situacao', SITUACOES)
  const prioridades = useOpcoes('prioridade', PRIORIDADES)
  const [verArquivados, setVerArquivados] = useState(false)
  const {
    colunas,
    titulo: tituloDoStatus,
    edicao,
    carregando: carregandoColunas,
  } = useColunasDoQuadro('demandas', COLUNAS_TAREFA)
  const [visao, setVisao] = useVisao('demandas')
  const [tipo, setTipo] = useState<TaskTipo | ''>('')
  const [responsaveis, setResponsaveis] = useState<string[]>([])
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
    // Chegar à última coluna conclui a demanda; sair dela reabre
    extras: (_tarefa, destino) =>
      esquema.cicloTarefa ? datasDoCiclo(destino, colunas[colunas.length - 1]?.id) : undefined,
    atividade: (tarefa, destino) =>
      destino === 'arquivado'
        ? null
        : {
            acao: destino === 'concluido' ? 'demanda_concluida' : 'demanda_movida',
            descricao:
              destino === 'concluido'
                ? `concluiu a demanda "${tarefa.titulo}"`
                : `moveu a demanda "${tarefa.titulo}" para ${tituloDoStatus(destino)}`,
            entidade: 'tasks',
            entidadeId: tarefa.id,
          },
  })

  const mudarSituacao = useSituacao<Task>({
    tabela: 'tasks',
    colunaDe: (tarefa) => tarefa.status,
    colunas,
    mover,
    disponivel: esquema.situacaoTarefa,
  })

  const consultas = juntarConsultas(tarefas, clientes, perfis)
  const todas = tarefas.data ?? []
  // Fora do quadro: o que foi arquivado e o que está concluído há mais de 7 dias
  const arquivada = (tarefa: Task) => tarefa.status === 'arquivado' || venceuOPrazoVisivel(tarefa)
  const arquivadas = todas.filter(arquivada)
  const noQuadro = todas.filter((tarefa) => !arquivada(tarefa))
  const visiveis = filtrarTarefas(noQuadro, { tipo, responsaveis })
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const hoje = hojeISO()
  const aberta = todas.find((t) => t.id === abertaId)

  const clienteDa = (tarefa: Task) => (tarefa.client_id ? clientePorId.get(tarefa.client_id) : undefined)
  const responsavelDa = (tarefa: Task) =>
    tarefa.responsavel_id ? perfilPorId.get(tarefa.responsavel_id) : undefined
  const prazoDa = (tarefa: Task) => situacaoDoPrazo(tarefa.data_entrega, hoje, !tarefaAberta(tarefa))
  const abrir = (tarefa: Task) => setParametros({ abrir: tarefa.id }, { replace: true })

  const colunasDaLista: ColunaDaTabela<Task>[] = [
    {
      chave: 'titulo',
      titulo: 'Demanda',
      render: (t) => <CelulaTitulo>{t.titulo}</CelulaTitulo>,
      ordem: (t) => t.titulo,
    },
    {
      chave: 'status',
      titulo: 'Status',
      render: (t) => <Pill tom={tarefaAberta(t) ? 'cinza' : 'verde'}>{tituloDoStatus(t.status)}</Pill>,
      ordem: (t) => colunas.findIndex((coluna) => coluna.id === t.status),
    },
    ...(esquema.prioridadeTarefa
      ? [
          {
            chave: 'prioridade',
            titulo: 'Prioridade',
            render: (t: Task) => {
              const nivel = prioridades.opcao(t.prioridade ?? 'media')
              return nivel ? <Pill tom={nivel.tom}>{nivel.rotulo}</Pill> : null
            },
            // Negativo para a primeira ordenação trazer o que é urgente para cima
            ordem: (t: Task) =>
              -prioridades.opcoes.findIndex((p) => p.valor === (t.prioridade ?? 'media')),
          },
        ]
      : []),
    {
      chave: 'responsavel',
      titulo: 'Responsável',
      render: (t) => <CelulaPessoa perfil={responsavelDa(t)} />,
      ordem: (t) => responsavelDa(t)?.nome ?? null,
    },
    {
      chave: 'entrega',
      titulo: 'Entrega',
      render: (t) => <CelulaPrazo data={t.data_entrega} prazo={prazoDa(t)} />,
      ordem: (t) => t.data_entrega,
    },
    {
      chave: 'cliente',
      titulo: 'Cliente',
      render: (t) => <CelulaCliente cliente={clienteDa(t)} />,
      ordem: (t) => clienteDa(t)?.nome ?? null,
    },
  ]

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
          <FiltroDeColaboradores
            perfis={perfis.data ?? []}
            selecionados={responsaveis}
            onMudar={setResponsaveis}
          />
        </div>
        <div className={quadro.acoes}>
          <button
            type="button"
            className={quadro.arquivados}
            aria-pressed={verArquivados}
            onClick={() => setVerArquivados((atual) => !atual)}
          >
            {verArquivados ? 'Ocultar arquivados' : 'Mostrar arquivados'}
            {arquivadas.length > 0 && <span>{arquivadas.length}</span>}
          </button>
          <AlternarVisao visao={visao} onMudar={setVisao} />
        </div>
      </div>

      {!edicao && !carregandoColunas && <AvisoDeMigracao />}

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
              ilustracao="quadro"
              titulo="Nenhuma demanda ainda."
              texto="Use o botão Criar, no topo, ou o + de uma coluna para criar a primeira."
            />
          ) : (
            visiveis.length === 0 && (
              <EstadoVazio ilustracao="busca" titulo="Nenhuma demanda com esses filtros." />
            )
          )}
          {visao === 'lista' ? (
            visiveis.length > 0 && (
              <TabelaDeTarefas
                rotulo="Lista de demandas"
                itens={visiveis}
                colunas={colunasDaLista}
                tituloDe={(tarefa) => tarefa.titulo}
                ordemInicial="entrega"
                onAbrir={abrir}
              />
            )
          ) : (
            <Quadro
              colunas={colunas}
              edicao={edicao}
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
                    cliente={clienteDa(tarefa)}
                    responsavel={responsavelDa(tarefa)}
                    dataEntrega={tarefa.data_entrega}
                    prazo={prazoDa(tarefa)}
                    prioridade={
                      tarefa.prioridade && tarefa.prioridade !== 'media'
                        ? prioridades.opcao(tarefa.prioridade)
                        : undefined
                    }
                    subtarefas={
                      subtarefas.disponivel
                        ? resumir(subtarefas.porCard.get(tarefa.id) ?? [])
                        : undefined
                    }
                    comentarios={comentarios.porTarefa.get(tarefa.id)?.length}
                    progresso={progressoNoQuadro(tarefa.status, colunas)}
                  />
                )
              }}
              renderRodape={(tarefa) => (
                <RodapeDoCard
                  quadro="demandas"
                  cardId={tarefa.id}
                  titulo={tarefa.titulo}
                  situacao={tarefa.situacao}
                  situacoes={situacoes.opcoes}
                  situacaoDisponivel={esquema.situacaoTarefa}
                  onSituacao={(situacao) => mudarSituacao(tarefa, situacao, todas)}
                  anexos={anexos.disponivel ? (anexos.porCard.get(tarefa.id) ?? []) : undefined}
                />
              )}
              onMover={(tarefa, destino) => mover(tarefa, destino, todas)}
              onArquivar={(tarefa) => mover(tarefa, 'arquivado', todas)}
              onCriar={(status) => criar({ categoria: 'demanda', status: status as TaskStatus })}
              onAbrir={abrir}
            />
          )}
          {verArquivados && (
            <Arquivados
              itens={arquivadas}
              tituloDe={(tarefa) => tarefa.titulo}
              colunas={[
                {
                  chave: 'cliente',
                  titulo: 'Cliente',
                  render: (t) => <CelulaCliente cliente={clienteDa(t)} />,
                  ordem: (t) => clienteDa(t)?.nome ?? null,
                },
                {
                  chave: 'responsavel',
                  titulo: 'Responsável',
                  render: (t) => <CelulaPessoa perfil={responsavelDa(t)} />,
                  ordem: (t) => responsavelDa(t)?.nome ?? null,
                },
              ]}
              comPrazo={esquema.cicloTarefa}
              onAbrir={abrir}
              onRestaurar={(tarefa) => mover(tarefa, colunas[0].id, todas)}
            />
          )}
        </>
      )}

      {aberta && (
        <TarefaDrawer
          key={aberta.id}
          tarefa={aberta}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          colunas={colunas}
          anexos={anexos.disponivel ? (anexos.porCard.get(aberta.id) ?? []) : undefined}
          subtarefas={subtarefas.disponivel ? (subtarefas.porCard.get(aberta.id) ?? []) : undefined}
          onSituacao={(situacao) => mudarSituacao(aberta, situacao, todas)}
          onMover={(destino) => mover(aberta, destino, todas)}
          onFechar={() => setParametros({}, { replace: true })}
        />
      )}
    </div>
  )
}
