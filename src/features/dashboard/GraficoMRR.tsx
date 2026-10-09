import { formatarMoeda } from '@/lib/formato'
import type { PontoDeMRR } from '@/lib/regras'
import styles from './dashboard.module.css'

const LARGURA = 600
const ALTURA = 200
const MARGEM = { topo: 28, lados: 34, base: 30 }

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

/** Gráfico de área do MRR mês a mês, desenhado em SVG sem biblioteca. */
export function GraficoMRR({ serie }: { serie: PontoDeMRR[] }) {
  const maior = Math.max(...serie.map((p) => p.valor), 1)
  const base = ALTURA - MARGEM.base
  const passo = (LARGURA - MARGEM.lados * 2) / Math.max(serie.length - 1, 1)

  const pontos = serie.map((ponto, i) => ({
    ...ponto,
    x: MARGEM.lados + passo * i,
    y: base - (ponto.valor / maior) * (base - MARGEM.topo),
  }))
  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = `${linha} L${pontos[pontos.length - 1].x},${base} L${pontos[0].x},${base} Z`
  const descricao = serie.map((p) => `${p.rotulo} ${formatarMoeda(p.valor)}`).join(', ')

  return (
    <svg
      className={styles.grafico}
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      role="img"
      aria-label={`MRR dos últimos ${serie.length} meses: ${descricao}`}
    >
      <defs>
        <linearGradient id="mrr-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e63030" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#e63030" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line className={styles.graficoBase} x1={MARGEM.lados} y1={base} x2={LARGURA - MARGEM.lados} y2={base} />
      <path d={area} fill="url(#mrr-area)" />
      <path className={styles.graficoLinha} d={linha} />
      {pontos.map((ponto) => (
        <g key={ponto.mes}>
          <circle className={styles.graficoPonto} cx={ponto.x} cy={ponto.y} r="4" />
          <text className={styles.graficoValor} x={ponto.x} y={ponto.y - 10} textAnchor="middle">
            {compacto.format(ponto.valor)}
          </text>
          <text className={styles.graficoMes} x={ponto.x} y={ALTURA - 8} textAnchor="middle">
            {ponto.rotulo}
          </text>
        </g>
      ))}
    </svg>
  )
}
