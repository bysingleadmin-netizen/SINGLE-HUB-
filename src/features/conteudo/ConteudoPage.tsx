import { responsaveisDe } from '@/lib/pessoas'
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
import { doColaborador, progressoNoQuadro } from '@/components/quadro/colunas'
import quadro from '@/components/quadro/pagina.module.css'
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
import { useColunasOpcionais } from '@/dados/esquema'
import { useExcluir } from '@/dados/excluir'
import { useOpcoes } from '@/dados/opcoes'
import { resumir, useSubtarefas } from '@/dados/subtarefas'
import { useCards, useClientes, usePerfis } from '@/dados/tabelas'
import { useCriar } from '@/features/criar/CriacaoContext'
import { hojeISO } from '@/lib/datas'
import { cardAberto, situacaoDoPrazo } from '@/lib/regras'
import { COLUNAS_CONTEUDO, PRIORIDADES, TIPOS_CONTEUDO } from '@/lib/rotulos'
import type { ContentCard, ContentEtapa, TipoConteudo } from '@/types/database'
import { CardDrawer } from './CardDrawer'
import { atividadeDoMovimento } from './card'

/** Passou do prazo sem ter sido publicado. */
function cardAtrasado(card: ContentCard, hoje: string): boolean {
  return card.etapa !== 'publicado' && card.data_entrega != null && card.data_entrega < hoje
}

export function ConteudoPage() {
  const cards = useCards()
  const excluir = useExcluir<ContentCard>({ tabela: 'content_cards', quadro: 'conteudo' })
  const toast = useToast()
  const excluirCard = (card: ContentCard) =>
    excluir.mutate(card.id, {
      onSuccess: () => toast.sucesso('Conteúdo excluído.'),
      onError: () => toast.erro('Não foi possível excluir o conteúdo.'),
    })
  const clientes = useClientes()
  const perfis = usePerfis()
  const criar = useCriar()
  const esquema = useColunasOpcionais()
  const anexos = useAnexos('conteudo')
  const subtarefas = useSubtarefas('conteudo')
  const prioridades = useOpcoes('prioridade', PRIORIDADES)
  const tipos = useOpcoes('tipo_conteudo', TIPOS_CONTEUDO)
  const [verArquivados, setVerArquivados] = useState(false)
  const {
    colunas,
    titulo: tituloDaEtapa,
    edicao,
    carregando: carregandoColunas,
  } = useColunasDoQuadro('conteudo', COLUNAS_CONTEUDO)
  const [visao, setVisao] = useVisao('conteudo')
  const [tipo, setTipo] = useState<TipoConteudo | ''>('')
  const [responsaveis, setResponsaveis] = useState<string[]>([])
  // O card aberto fica no endereço, para a busca levar direto a ele
  const [parametros, setParametros] = useSearchParams()
  const abertoId = parametros.get('abrir')

  const mover = useMover<ContentCard>({
    tabela: 'content_cards',
    campo: 'etapa',
    sucesso: (_card, destino) =>
      destino === 'arquivado'
        ? 'Conteúdo arquivado.'
        : destino === 'publicado'
          ? 'Conteúdo publicado.'
          : `Conteúdo movido para ${tituloDaEtapa(destino)}.`,
    erro: 'Não foi possível mover o conteúdo.',
    // Chegar à última etapa conclui o conteúdo; sair dela reabre
    extras: (_card, destino) =>
      esquema.cicloConteudo ? datasDoCiclo(destino, colunas[colunas.length - 1]?.id) : undefined,
    atividade: (card, destino) => atividadeDoMovimento(card, destino, tituloDaEtapa(destino)),
  })

  const consultas = juntarConsultas(cards, clientes, perfis)
  const todos = cards.data ?? []
  // Fora do quadro: o que foi arquivado e o que está concluído há mais de 7 dias
  const arquivado = (card: ContentCard) => card.etapa === 'arquivado' || venceuOPrazoVisivel(card)
  const arquivados = todos.filter(arquivado)
  const noQuadro = todos.filter((card) => !arquivado(card))
  const visiveis = noQuadro.filter(
    (card) =>
      (tipo === '' || card.tipo_conteudo === tipo) && doColaborador(responsaveisDe(card), responsaveis),
  )
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const hoje = hojeISO()
  const aberto = todos.find((c) => c.id === abertoId)

  const clienteDo = (card: ContentCard) => (card.client_id ? clientePorId.get(card.client_id) : undefined)
  // Todos os responsáveis do conteúdo, o principal primeiro
  const responsaveisDo = (card: ContentCard) =>
    responsaveisDe(card).flatMap((id) => perfilPorId.get(id) ?? [])
  const responsavelDo = (card: ContentCard) => responsaveisDo(card)[0]
  const prazoDo = (card: ContentCard) => situacaoDoPrazo(card.data_entrega, hoje, !cardAberto(card))
  const abrir = (card: ContentCard) => setParametros({ abrir: card.id }, { replace: true })

  const colunasDaLista: ColunaDaTabela<ContentCard>[] = [
    {
      chave: 'titulo',
      titulo: 'Conteúdo',
      render: (c) => <CelulaTitulo>{c.titulo}</CelulaTitulo>,
      ordem: (c) => c.titulo,
    },
    {
      chave: 'etapa',
      titulo: 'Etapa',
      // O selo é o próprio seletor: clicar abre as etapas e move o conteúdo
      render: (c) => (
        <StatusSelect
          pilula
          ocultarRotulo
          rotulo={`Etapa de ${c.titulo}`}
          opcoes={colunas.map((coluna) => ({
            valor: coluna.id,
            rotulo: coluna.titulo,
            tom: coluna.id === 'publicado' ? 'verde' : 'cinza',
          }))}
          value={c.etapa}
          onChange={(destino) => mover(c, destino, todos)}
        />
      ),
      ordem: (c) => colunas.findIndex((coluna) => coluna.id === c.etapa),
    },
    ...(esquema.prioridadeConteudo
      ? [
          {
            chave: 'prioridade',
            titulo: 'Prioridade',
            render: (c: ContentCard) => {
              const nivel = prioridades.opcao(c.prioridade ?? 'media')
              return nivel ? <Pill tom={nivel.tom} cor={nivel.cor}>{nivel.rotulo}</Pill> : null
            },
            ordem: (c: ContentCard) =>
              -prioridades.opcoes.findIndex((p) => p.valor === (c.prioridade ?? 'media')),
          },
        ]
      : []),
    {
      chave: 'responsavel',
      titulo: 'Responsável',
      render: (c) => <CelulaPessoa perfil={responsavelDo(c)} outros={responsaveisDo(c).length - 1} />,
      ordem: (c) => responsavelDo(c)?.nome ?? null,
    },
    {
      chave: 'entrega',
      titulo: 'Entrega',
      render: (c) => <CelulaPrazo data={c.data_entrega} prazo={prazoDo(c)} />,
      ordem: (c) => c.data_entrega,
    },
    {
      chave: 'cliente',
      titulo: 'Cliente',
      render: (c) => <CelulaCliente cliente={clienteDo(c)} />,
      ordem: (c) => clienteDo(c)?.nome ?? null,
    },
  ]

  return (
    <div className={quadro.pagina}>
      <div className={quadro.barra}>
        <div className={quadro.filtros}>
          <StatusSelect
            rotulo="Tipo de conteúdo"
            vazio="Todos os tipos"
            opcoes={tipos.opcoes}
            value={tipo}
            onChange={(valor) => setTipo(valor as TipoConteudo | '')}
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
            {arquivados.length > 0 && <span>{arquivados.length}</span>}
          </button>
          <AlternarVisao visao={visao} onMudar={setVisao} />
        </div>
      </div>

      {!edicao && !carregandoColunas && <AvisoDeMigracao />}

      {consultas.erro ? (
        <EstadoErro onTentar={consultas.tentar} />
      ) : consultas.carregando ? (
        <div className={quadro.carregando} aria-busy="true">
          {COLUNAS_CONTEUDO.map((coluna) => (
            <Skeleton key={coluna.id} altura="220px" raio="var(--radius)" />
          ))}
        </div>
      ) : (
        <>
          {noQuadro.length === 0 ? (
            <EstadoVazio
              ilustracao="quadro"
              titulo="Nenhum conteúdo ainda."
              texto="Use o botão Criar, no topo, ou o + de uma etapa para criar o primeiro."
            />
          ) : (
            visiveis.length === 0 && (
              <EstadoVazio ilustracao="busca" titulo="Nenhum conteúdo com esses filtros." />
            )
          )}
          {visao === 'lista' ? (
            visiveis.length > 0 && (
              <TabelaDeTarefas
                rotulo="Lista de conteúdos"
                itens={visiveis}
                colunas={colunasDaLista}
                tituloDe={(card) => card.titulo}
                ordemInicial="entrega"
                onAbrir={abrir}
                acoes={(card) => (
                  <MenuAcoes
                    nome={card.titulo}
                    onEditar={() => abrir(card)}
                    onExcluir={() => excluirCard(card)}
                  />
                )}
              />
            )
          ) : (
            <Quadro
              colunas={colunas}
              edicao={edicao}
              itens={visiveis}
              colunaDe={(card) => card.etapa}
              tituloDe={(card) => card.titulo}
              atrasado={(card) => cardAtrasado(card, hoje)}
              renderCard={(card) => {
                const tipoDoCard = tipos.opcao(card.tipo_conteudo)
                return (
                  <CardInfo
                    titulo={card.titulo}
                    etiqueta={tipoDoCard && <Pill tom={tipoDoCard.tom} cor={tipoDoCard.cor}>{tipoDoCard.rotulo}</Pill>}
                    cliente={clienteDo(card)}
                    responsaveis={responsaveisDo(card)}
                    dataEntrega={card.data_entrega}
                    prazo={prazoDo(card)}
                    prioridade={
                      card.prioridade && card.prioridade !== 'media'
                        ? prioridades.opcao(card.prioridade)
                        : undefined
                    }
                    subtarefas={
                      subtarefas.disponivel ? resumir(subtarefas.porCard.get(card.id) ?? []) : undefined
                    }
                    progresso={progressoNoQuadro(card.etapa, colunas)}
                  />
                )
              }}
              renderRodape={(card) => (
                <RodapeDoCard
                  quadro="conteudo"
                  cardId={card.id}
                  titulo={card.titulo}
                  anexos={anexos.disponivel ? (anexos.porCard.get(card.id) ?? []) : undefined}
                />
              )}
              onMover={(card, destino) => mover(card, destino, todos)}
              onArquivar={(card) => mover(card, 'arquivado', todos)}
              onExcluir={excluirCard}
              onCriar={(etapa) => criar({ categoria: 'conteudo', etapa: etapa as ContentEtapa })}
              onAbrir={abrir}
            />
          )}
          {verArquivados && (
            <Arquivados
              itens={arquivados}
              tituloDe={(card) => card.titulo}
              colunas={[
                {
                  chave: 'cliente',
                  titulo: 'Cliente',
                  render: (c) => <CelulaCliente cliente={clienteDo(c)} />,
                  ordem: (c) => clienteDo(c)?.nome ?? null,
                },
                {
                  chave: 'responsavel',
                  titulo: 'Responsável',
                  render: (c) => <CelulaPessoa perfil={responsavelDo(c)} outros={responsaveisDo(c).length - 1} />,
                  ordem: (c) => responsavelDo(c)?.nome ?? null,
                },
              ]}
              comPrazo={esquema.cicloConteudo}
              onAbrir={abrir}
              onRestaurar={(card) => mover(card, colunas[0].id, todos)}
            />
          )}
        </>
      )}

      {aberto && (
        <CardDrawer
          key={aberto.id}
          card={aberto}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          colunas={colunas}
          anexos={anexos.disponivel ? (anexos.porCard.get(aberto.id) ?? []) : undefined}
          subtarefas={subtarefas.disponivel ? (subtarefas.porCard.get(aberto.id) ?? []) : undefined}
          onMover={(destino) => mover(aberto, destino, todos)}
          onFechar={() => setParametros({}, { replace: true })}
        />
      )}
    </div>
  )
}
