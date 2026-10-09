import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlternarVisao, useVisao } from '@/components/quadro/AlternarVisao'
import { CardInfo } from '@/components/quadro/CardInfo'
import { FiltroDeColaboradores } from '@/components/quadro/FiltroDeColaboradores'
import { Quadro } from '@/components/quadro/Quadro'
import { TabelaDeTarefas } from '@/components/quadro/TabelaDeTarefas'
import type { ColunaDaTabela } from '@/components/quadro/TabelaDeTarefas'
import {
  CelulaCliente,
  CelulaPessoa,
  CelulaPrazo,
  CelulaPrioridade,
  CelulaTitulo,
} from '@/components/quadro/celulas'
import { doColaborador, progressoNoQuadro } from '@/components/quadro/colunas'
import quadro from '@/components/quadro/pagina.module.css'
import { useMover } from '@/components/quadro/useMover'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { juntarConsultas, porId } from '@/dados/base'
import { useColunasDoQuadro } from '@/dados/colunas'
import { useColunasOpcionais } from '@/dados/esquema'
import { useCards, useClientes, usePerfis } from '@/dados/tabelas'
import { useCriar } from '@/features/criar/CriacaoContext'
import { hojeISO } from '@/lib/datas'
import { cardAberto, situacaoDoPrazo } from '@/lib/regras'
import { COLUNAS_CONTEUDO, TIPOS_CONTEUDO, opcao, pesoDaPrioridade } from '@/lib/rotulos'
import type { ContentCard, ContentEtapa, TipoConteudo } from '@/types/database'
import { CardDrawer } from './CardDrawer'
import { atividadeDoMovimento } from './card'

/** Passou do prazo sem ter sido publicado. */
function cardAtrasado(card: ContentCard, hoje: string): boolean {
  return card.etapa !== 'publicado' && card.data_entrega != null && card.data_entrega < hoje
}

export function ConteudoPage() {
  const cards = useCards()
  const clientes = useClientes()
  const perfis = usePerfis()
  const criar = useCriar()
  const esquema = useColunasOpcionais()
  const { colunas, titulo: tituloDaEtapa, edicao } = useColunasDoQuadro('conteudo', COLUNAS_CONTEUDO)
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
    atividade: (card, destino) => atividadeDoMovimento(card, destino, tituloDaEtapa(destino)),
  })

  const consultas = juntarConsultas(cards, clientes, perfis)
  const todos = cards.data ?? []
  const noQuadro = todos.filter((card) => card.etapa !== 'arquivado')
  const visiveis = noQuadro.filter(
    (card) =>
      (tipo === '' || card.tipo_conteudo === tipo) && doColaborador(card.responsavel_id, responsaveis),
  )
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const hoje = hojeISO()
  const aberto = todos.find((c) => c.id === abertoId)

  const clienteDo = (card: ContentCard) => (card.client_id ? clientePorId.get(card.client_id) : undefined)
  const responsavelDo = (card: ContentCard) =>
    card.responsavel_id ? perfilPorId.get(card.responsavel_id) : undefined
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
      render: (c) => <Pill tom={cardAberto(c) ? 'cinza' : 'verde'}>{tituloDaEtapa(c.etapa)}</Pill>,
      ordem: (c) => colunas.findIndex((coluna) => coluna.id === c.etapa),
    },
    ...(esquema.prioridadeConteudo
      ? [
          {
            chave: 'prioridade',
            titulo: 'Prioridade',
            render: (c: ContentCard) => <CelulaPrioridade prioridade={c.prioridade} />,
            ordem: (c: ContentCard) => -pesoDaPrioridade(c.prioridade),
          },
        ]
      : []),
    {
      chave: 'responsavel',
      titulo: 'Responsável',
      render: (c) => <CelulaPessoa perfil={responsavelDo(c)} />,
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
          <Selecao
            rotulo="Tipo de conteúdo"
            vazio="Todos os tipos"
            opcoes={TIPOS_CONTEUDO}
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as TipoConteudo | '')}
          />
          <FiltroDeColaboradores
            perfis={perfis.data ?? []}
            selecionados={responsaveis}
            onMudar={setResponsaveis}
          />
        </div>
        <AlternarVisao visao={visao} onMudar={setVisao} />
      </div>

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
                const tipoDoCard = opcao(TIPOS_CONTEUDO, card.tipo_conteudo)
                return (
                  <CardInfo
                    titulo={card.titulo}
                    etiqueta={<Pill tom={tipoDoCard.tom}>{tipoDoCard.rotulo}</Pill>}
                    cliente={clienteDo(card)}
                    responsavel={responsavelDo(card)}
                    dataEntrega={card.data_entrega}
                    prazo={prazoDo(card)}
                    prioridade={card.prioridade}
                    progresso={progressoNoQuadro(card.etapa, colunas)}
                  />
                )
              }}
              onMover={(card, destino) => mover(card, destino, todos)}
              onArquivar={(card) => mover(card, 'arquivado', todos)}
              onCriar={(etapa) => criar({ categoria: 'conteudo', etapa: etapa as ContentEtapa })}
              onAbrir={abrir}
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
          onMover={(destino) => mover(aberto, destino, todos)}
          onFechar={() => setParametros({}, { replace: true })}
        />
      )}
    </div>
  )
}
