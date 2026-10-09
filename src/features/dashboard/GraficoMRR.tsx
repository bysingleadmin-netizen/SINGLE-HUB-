import { useLayoutEffect, useRef, useState } from 'react'
import { formatarMoeda } from '@/lib/formato'
import type { PontoDeMRR } from '@/lib/regras'
import { geometriaDoGrafico } from './grafico'
import styles from './dashboard.module.css'

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })

/** Primeiro rótulo encosta à esquerda e o último à direita, para não sair da área. */
function ancora(indice: number, total: number): 'start' | 'middle' | 'end' {
  if (indice === 0) return 'start'
  return indice === total - 1 ? 'end' : 'middle'
}

/** Gráfico de área do MRR mês a mês, em SVG, do tamanho do espaço que o card oferece. */
export function GraficoMRR({ serie }: { serie: PontoDeMRR[] }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [tamanho, setTamanho] = useState({ largura: 600, altura: 220 })

  useLayoutEffect(() => {
    const elemento = caixa.current
    if (!elemento || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect
      if (width > 0 && height > 0) {
        setTamanho({ largura: Math.round(width), altura: Math.round(height) })
      }
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  const { largura, altura } = tamanho
  const { pontos, base } = geometriaDoGrafico(serie, largura, altura)
  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area =
    pontos.length > 0
      ? `${linha} L${pontos[pontos.length - 1].x},${base} L${pontos[0].x},${base} Z`
      : ''
  const descricao = serie.map((p) => `${p.rotulo} ${formatarMoeda(p.valor)}`).join(', ')

  return (
    <div ref={caixa} className={styles.grafico}>
      {/* O tamanho vem do CSS (100% da caixa); o viewBox acompanha em pixels, então nada é esticado */}
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        role="img"
        aria-label={`MRR dos últimos ${serie.length} meses: ${descricao}`}
      >
        <defs>
          <linearGradient id="mrr-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e63030" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#e63030" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#mrr-area)" />
        <path className={styles.graficoLinha} d={linha} />
        {pontos.map((ponto, i) => (
          <g key={ponto.mes}>
            <circle className={styles.graficoPonto} cx={ponto.x} cy={ponto.y} r="3.5" />
            <text
              className={styles.graficoRotulo}
              x={ponto.x}
              y={ponto.y - 9}
              textAnchor={ancora(i, pontos.length)}
            >
              {compacto.format(ponto.valor)}
            </text>
            <text
              className={styles.graficoRotulo}
              x={ponto.x}
              y={altura - 16}
              textAnchor={ancora(i, pontos.length)}
            >
              {ponto.rotulo}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
