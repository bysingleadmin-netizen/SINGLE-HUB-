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
import { Skeleton } from '@/components/ui/Skeleton'
import { juntarConsultas, porId } from '@/dados/base'
import { useCards, useClientes, usePerfis } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { situacaoDoPrazo } from '@/lib/regras'
import { COLUNAS_CONTEUDO, TIPOS_CONTEUDO, opcao } from '@/lib/rotulos'
import type { ContentCard, ContentEtapa } from '@/types/database'
import { CardDrawer } from './CardDrawer'
import { CardModal } from './CardModal'
import { atividadeDoMovimento, tituloDaEtapa } from './card'

/** Passou do prazo sem ter sido publicado. */
function cardAtrasado(card: ContentCard, hoje: string): boolean {
  return card.etapa !== 'publicado' && card.data_entrega != null && card.data_entrega < hoje
}

export function ConteudoPage() {
  const cards = useCards()
  const clientes = useClientes()
  const perfis = usePerfis()
  /** Etapa em que o modal de novo conteúdo abre; undefined quando fechado */
  const [criandoEm, setCriandoEm] = useState<ContentEtapa>()
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
  const clientePorId = porId(clientes.data)
  const perfilPorId = porId(perfis.data)
  const hoje = hojeISO()
  const aberto = todos.find((c) => c.id === abertoId)

  return (
    <div className={quadro.pagina}>
      <div className={quadro.barra}>
        <span />
        <Button onClick={() => setCriandoEm('captar_material')}>
          <Icone nome="mais" tamanho={16} />
          Novo conteúdo
        </Button>
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
          {noQuadro.length === 0 && (
            <EstadoVazio
              ilustracao="quadro" titulo="Nenhum conteúdo ainda."
              texto="Use Novo conteúdo ou o botão de adicionar de uma etapa para criar o primeiro."
            />
          )}
          <Quadro
            colunas={COLUNAS_CONTEUDO}
            itens={noQuadro}
            colunaDe={(card) => card.etapa}
            tituloDe={(card) => card.titulo}
            atrasado={(card) => cardAtrasado(card, hoje)}
            renderCard={(card) => {
              const tipo = opcao(TIPOS_CONTEUDO, card.tipo_conteudo)
              return (
                <CardInfo
                  titulo={card.titulo}
                  etiqueta={<Pill tom={tipo.tom}>{tipo.rotulo}</Pill>}
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
            onCriar={(etapa) => setCriandoEm(etapa as ContentEtapa)}
            onAbrir={(card) => setParametros({ abrir: card.id }, { replace: true })}
          />
        </>
      )}

      {criandoEm && (
        <CardModal
          etapaInicial={criandoEm}
          cards={todos}
          clientes={clientes.data ?? []}
          perfis={perfis.data ?? []}
          onFechar={() => setCriandoEm(undefined)}
        />
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
