import { useState } from 'react'
import { Painel } from '@/components/ui/Painel'
import { Selecao } from '@/components/ui/Selecao'
import { hojeISO } from '@/lib/datas'
import { plural } from '@/lib/regras'
import { BarrasHorizontais } from './BarrasHorizontais'
import { PERIODOS_DO_VOLUME, intervaloDoVolume, volumePorColuna } from './volume'
import type { ItemDoVolume, PeriodoDoVolume } from './volume'
import styles from './graficos.module.css'

interface PainelDeVolumeProps {
  /** Título do painel, como "Demandas por coluna" */
  titulo: string
  /** O que as barras medem, para leitores de tela */
  descricao: string
  /** Palavra para o total: ['demanda', 'demandas'] */
  unidade: [string, string]
  clientes: { id: string; nome: string }[]
  colunas: readonly { id: string; titulo: string }[]
  itens: ItemDoVolume[]
}

/**
 * Painel com o gráfico de volume de um quadro: escolher um cliente e um período atualiza as
 * barras na hora. É o mesmo em Demandas, Conteúdo e Anúncios.
 */
export function PainelDeVolume({ titulo, descricao, unidade, clientes, colunas, itens }: PainelDeVolumeProps) {
  const [clienteId, setClienteId] = useState('')
  const [periodo, setPeriodo] = useState<PeriodoDoVolume>('')
  const barras = volumePorColuna(itens, colunas, { clienteId, intervalo: intervaloDoVolume(periodo, hojeISO()) })
  const total = barras.reduce((soma, barra) => soma + barra.valor, 0)

  return (
    <Painel titulo={titulo}>
      <div className={styles.volumeFiltros}>
        <Selecao
          rotulo="Cliente do gráfico"
          vazio="Todos os clientes"
          opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
          value={clienteId}
          onChange={(evento) => setClienteId(evento.target.value)}
        />
        <Selecao
          rotulo="Período do gráfico"
          vazio="Todo o período"
          opcoes={PERIODOS_DO_VOLUME}
          value={periodo}
          onChange={(evento) => setPeriodo(evento.target.value as PeriodoDoVolume)}
        />
        <span className={styles.volumeTotal}>{plural(total, unidade[0], unidade[1])}</span>
      </div>
      <BarrasHorizontais titulo={descricao} itens={barras} />
    </Painel>
  )
}
