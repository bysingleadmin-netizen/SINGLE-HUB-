import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CardInfo } from '@/components/quadro/CardInfo'
import { Quadro } from '@/components/quadro/Quadro'
import quadro from '@/components/quadro/pagina.module.css'
import { useMover } from '@/components/quadro/useMover'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { juntarConsultas, porId } from '@/dados/base'
import { useCards, useClientes, usePerfis } from '@/dados/tabelas'
import { useCriar } from '@/features/criar/CriacaoContext'
import { hojeISO } from '@/lib/datas'
import { situacaoDoPrazo } from '@/lib/regras'
import { COLUNAS_CONTEUDO, TIPOS_CONTEUDO, opcao } from '@/lib/rotulos'
import type { ContentCard, ContentEtapa, TipoConteudo } from '@/types/database'
import { CardDrawer } from './CardDrawer'
import { atividadeDoMovimento, tituloDaEtapa } from './card'

/** Passou do prazo sem ter sido publicado. */
function cardAtrasado(card: ContentCard, hoje: string): boolean {
  return card.etapa !== 'publicado' && card.data_entrega != null && card.data_entrega < hoje
}

export function ConteudoPage() {
  const cards = useCards()
  const clientes = useClientes()
  const perfis = usePerfis()
  const criar = useCriar()
  const [tipo, setTipo] = useState<TipoConteudo | ''>('')
  const [responsavel, setResponsavel] = useState('')
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
    atividade: atividadeDoMovimento,
  })

  const consultas = juntarConsultas(cards, clientes, perfis)
  const todos = cards.data ?? []
  const noQuadro = todos.filter((card) => card.etapa !== 'arquivado')
  const visiveis = noQuadro.filter(
    (card) =>
      (tipo === '' || card.tipo_conteudo === tipo) &&
      (responsavel === '' || card.responsavel_id === responsavel),
  )
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const hoje = hojeISO()
  const aberto = todos.find((c) => c.id === abertoId)

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
          <Selecao
            rotulo="Responsável"
            vazio="Toda a equipe"
            opcoes={(perfis.data ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))}
            value={responsavel}
            onChange={(evento) => setResponsavel(evento.target.value)}
          />
        </div>
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
          <Quadro
            colunas={COLUNAS_CONTEUDO}
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
                  cliente={card.client_id ? clientePorId.get(card.client_id) : undefined}
                  responsavel={
                    card.responsavel_id ? perfilPorId.get(card.responsavel_id) : undefined
                  }
                  dataEntrega={card.data_entrega}
                  prazo={situacaoDoPrazo(card.data_entrega, hoje, card.etapa === 'publicado')}
                />
              )
            }}
            onMover={(card, destino) => mover(card, destino, todos)}
            onArquivar={(card) => mover(card, 'arquivado', todos)}
            onCriar={(etapa) => criar({ categoria: 'conteudo', etapa: etapa as ContentEtapa })}
            onAbrir={(card) => setParametros({ abrir: card.id }, { replace: true })}
          />
        </>
      )}

      {aberto && (
        <CardDrawer
          key={aberto.id}
          card={aberto}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          onMover={(destino) => mover(aberto, destino, todos)}
          onFechar={() => setParametros({}, { replace: true })}
        />
      )}
    </div>
  )
}
