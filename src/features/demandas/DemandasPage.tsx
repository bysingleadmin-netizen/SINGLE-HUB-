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
import pagina from '@/components/quadro/pagina.module.css'
import { useMover } from '@/components/quadro/useMover'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { MenuAcoes } from '@/components/ui/MenuDeAcoes'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useToast } from '@/components/ui/Toast'
import { useAnexos } from '@/dados/anexos'
import { juntarConsultas, porId } from '@/dados/base'
import { useColunasDoQuadro } from '@/dados/colunas'
import { useComentarios } from '@/dados/comentarios'
import { useColunasOpcionais } from '@/dados/esquema'
import { useExcluir } from '@/dados/excluir'
import { useOpcoes } from '@/dados/opcoes'
import { resumir, useSubtarefas } from '@/dados/subtarefas'
import { useClientes, usePerfis, useTarefas } from '@/dados/tabelas'
import { useCriar } from '@/features/criar/CriacaoContext'
import { hojeISO } from '@/lib/datas'
import { situacaoDoPrazo, tarefaAberta, tarefaAtrasada } from '@/lib/regras'
import { COLUNAS_TAREFA, PRIORIDADES, TIPOS_TAREFA, opcao } from '@/lib/rotulos'
import type { Task, TaskStatus, TaskTipo } from '@/types/database'
import { TarefaDrawer } from './TarefaDrawer'
import { filtrarTarefas } from './tarefa'

const quadro = 'demandas'

/** Quadro de Demandas: pedidos dos clientes e o trabalho interno da agência. */
export function DemandasPage() {
  const tarefas = useTarefas()
  const clientes = useClientes()
  const perfis = usePerfis()
  const criar = useCriar()
  const esquema = useColunasOpcionais()
  const comentarios = useComentarios()
  const anexos = useAnexos(quadro)
  const subtarefas = useSubtarefas(quadro)
  const excluir = useExcluir<Task>({ tabela: 'tasks', quadro })
  const toast = useToast()
  const excluirTarefa = (tarefa: Task) =>
    excluir.mutate(tarefa.id, {
      onSuccess: () => toast.sucesso(`Demanda excluída.`),
      onError: () => toast.erro(`Não foi possível excluir a demanda.`),
    })
  const prioridades = useOpcoes('prioridade', PRIORIDADES)
  const [verArquivados, setVerArquivados] = useState(false)
  const {
    colunas,
    titulo: tituloDoStatus,
    edicao,
    carregando: carregandoColunas,
  } = useColunasDoQuadro(quadro, COLUNAS_TAREFA)
  const [visao, setVisao] = useVisao(quadro)
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
        ? `Demanda arquivada.`
        : `Demanda movida para ${tituloDoStatus(destino)}.`,
    erro: `Não foi possível mover a demanda.`,
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

  const consultas = juntarConsultas(tarefas, clientes, perfis)
  // Todas as tarefas: as do antigo quadro de Tarefas também (a migration 0008 as traz para cá)
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
      // O selo é o próprio seletor: clicar abre as colunas e move a tarefa
      render: (t) => (
        <StatusSelect
          pilula
          ocultarRotulo
          rotulo={`Status de ${t.titulo}`}
          opcoes={colunas.map((coluna) => ({
            valor: coluna.id,
            rotulo: coluna.titulo,
            tom: coluna.id === 'concluido' ? 'verde' : 'cinza',
          }))}
          value={t.status}
          onChange={(destino) => mover(t, destino, todas)}
        />
      ),
      ordem: (t) => colunas.findIndex((coluna) => coluna.id === t.status),
    },
    ...(esquema.prioridadeTarefa
      ? [
          {
            chave: 'prioridade',
            titulo: 'Prioridade',
            render: (t: Task) => {
              const nivel = prioridades.opcao(t.prioridade ?? 'media')
              return nivel ? <Pill tom={nivel.tom} cor={nivel.cor}>{nivel.rotulo}</Pill> : null
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
    <div className={pagina.pagina}>
      <div className={pagina.barra}>
        <div className={pagina.filtros}>
          <StatusSelect
            rotulo="Área"
            vazio="Todas as áreas"
            opcoes={TIPOS_TAREFA}
            value={tipo}
            onChange={(valor) => setTipo(valor as TaskTipo | '')}
          />
          <FiltroDeColaboradores
            perfis={perfis.data ?? []}
            selecionados={responsaveis}
            onMudar={setResponsaveis}
          />
        </div>
        <div className={pagina.acoes}>
          <button
            type="button"
            className={pagina.arquivados}
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
        <div className={pagina.carregando} aria-busy="true">
          {COLUNAS_TAREFA.map((coluna) => (
            <Skeleton key={coluna.id} altura="220px" raio="var(--radius)" />
          ))}
        </div>
      ) : (
        <>
          {noQuadro.length === 0 ? (
            <EstadoVazio
              ilustracao="quadro"
              titulo={`Nenhuma demanda ainda.`}
              texto="Use o botão Criar, no topo, ou o + de uma coluna para criar a primeira."
            />
          ) : (
            visiveis.length === 0 && (
              <EstadoVazio ilustracao="busca" titulo={`Nenhuma demanda com esses filtros.`} />
            )
          )}
          {visao === 'lista' ? (
            visiveis.length > 0 && (
              <TabelaDeTarefas
                rotulo={`Lista de demandas`}
                itens={visiveis}
                colunas={colunasDaLista}
                tituloDe={(tarefa) => tarefa.titulo}
                ordemInicial="entrega"
                onAbrir={abrir}
                acoes={(tarefa) => (
                  <MenuAcoes
                    nome={tarefa.titulo}
                    onEditar={() => abrir(tarefa)}
                    onExcluir={() => excluirTarefa(tarefa)}
                  />
                )}
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
                const tipoDaTarefa = tarefa.tipo ? opcao(TIPOS_TAREFA, tarefa.tipo) : undefined
                return (
                  <CardInfo
                    titulo={tarefa.titulo}
                    etiqueta={
                      tipoDaTarefa && <Pill tom={tipoDaTarefa.tom}>{tipoDaTarefa.rotulo}</Pill>
                    }
                    cliente={clienteDa(tarefa)}
                    responsaveis={[responsavelDa(tarefa)].filter((p) => !!p)}
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
                  quadro={quadro}
                  cardId={tarefa.id}
                  titulo={tarefa.titulo}
                  anexos={anexos.disponivel ? (anexos.porCard.get(tarefa.id) ?? []) : undefined}
                />
              )}
              onMover={(tarefa, destino) => mover(tarefa, destino, todas)}
              onArquivar={(tarefa) => mover(tarefa, 'arquivado', todas)}
              onExcluir={excluirTarefa}
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
          onMover={(destino) => mover(aberta, destino, todas)}
          onFechar={() => setParametros({}, { replace: true })}
        />
      )}
    </div>
  )
}
