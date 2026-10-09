import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { formatarMoeda } from '@/lib/formato'
import type { PontoDeMRR } from '@/lib/regras'
import { geometriaDoGrafico, pontoMaisProximo, variacao } from './grafico'
import styles from './dashboard.module.css'

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
const percentual = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

/** Primeiro rótulo encosta à esquerda e o último à direita, para não sair da área. */
function ancora(indice: number, total: number): 'start' | 'middle' | 'end' {
  if (indice === 0) return 'start'
  return indice === total - 1 ? 'end' : 'middle'
}

interface GraficoMRRProps {
  serie: PontoDeMRR[]
  /** O que a série mede, para leitores de tela. O Financeiro usa o mesmo gráfico para o faturamento */
  nome?: string
  /** Como mostrar o valor na dica que acompanha o mouse */
  formatar?: (valor: number) => string
}

/**
 * Gráfico de área mês a mês, em SVG, do tamanho do espaço que o card oferece.
 * Passar o mouse mostra o valor exato do mês mais próximo; o cabeçalho compara o último
 * mês com o anterior.
 */
export function GraficoMRR({ serie, nome = 'MRR', formatar = formatarMoeda }: GraficoMRRProps) {
  const caixa = useRef<HTMLDivElement>(null)
  const gradiente = useId()
  const [tamanho, setTamanho] = useState({ largura: 600, altura: 240 })
  const [ativo, setAtivo] = useState<number | null>(null)

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
  const { pontos, base, topo } = geometriaDoGrafico(serie, largura, altura)
  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area =
    pontos.length > 0
      ? `${linha} L${pontos[pontos.length - 1].x},${base} L${pontos[0].x},${base} Z`
      : ''
  const descricao = serie.map((p) => `${p.rotulo} ${formatarMoeda(p.valor)}`).join(', ')
  const mudanca = variacao(serie)
  const destacado = ativo != null ? pontos[ativo] : undefined

  function aoMover(evento: MouseEvent<HTMLDivElement>) {
    const { left } = evento.currentTarget.getBoundingClientRect()
    setAtivo(pontoMaisProximo(pontos, evento.clientX - left))
  }

  return (
    <div className={styles.graficoBloco}>
      {mudanca != null && serie.length > 1 && (
        <p className={styles.graficoResumo}>
          <span className={styles.graficoVariacao} data-sinal={mudanca < 0 ? 'negativo' : 'positivo'}>
            {percentual.format(mudanca)}
          </span>
          em relação a {serie[serie.length - 2].rotulo}
        </p>
      )}
      <div
        ref={caixa}
        className={styles.grafico}
        onMouseMove={aoMover}
        onMouseLeave={() => setAtivo(null)}
      >
        {/* O tamanho vem do CSS (100% da caixa); o viewBox acompanha em pixels, então nada é esticado */}
        <svg
          viewBox={`0 0 ${largura} ${altura}`}
          role="img"
          aria-label={`${nome} dos últimos ${serie.length} meses: ${descricao}`}
        >
          <defs>
            <linearGradient id={gradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e63030" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#e63030" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((fracao) => (
            <line
              key={fracao}
              className={styles.graficoGrade}
              x1={0}
              x2={largura}
              y1={topo + (base - topo) * fracao}
              y2={topo + (base - topo) * fracao}
            />
          ))}
          <path className={styles.graficoArea} d={area} fill={`url(#${gradiente})`} />
          <path className={styles.graficoLinha} d={linha} />
          {destacado && (
            <line className={styles.graficoGuia} x1={destacado.x} x2={destacado.x} y1={topo} y2={base} />
          )}
          {pontos.map((ponto, i) => (
            <g key={ponto.mes}>
              <circle
                className={styles.graficoPonto}
                data-ativo={i === ativo || undefined}
                cx={ponto.x}
                cy={ponto.y}
                r={i === ativo ? 5 : 3.5}
              />
              <text
                className={styles.graficoRotulo}
                x={ponto.x}
                y={ponto.y - 10}
                textAnchor={ancora(i, pontos.length)}
              >
                {compacto.format(ponto.valor)}
              </text>
              <text
                className={styles.graficoRotulo}
                x={ponto.x}
                y={altura - 6}
                textAnchor={ancora(i, pontos.length)}
              >
                {ponto.rotulo}
              </text>
            </g>
          ))}
        </svg>
        {destacado && (
          <div
            className={styles.graficoDica}
            role="presentation"
            style={{
              // Perto das bordas a dica se apoia no lado de dentro para não ser cortada
              left: Math.min(Math.max(destacado.x, 70), largura - 70),
              top: Math.max(destacado.y - 14, 34),
            }}
          >
            <span className={styles.graficoDicaRotulo}>{destacado.rotulo}</span>
            <strong>{formatar(destacado.valor)}</strong>
          </div>
        )}
      </div>
    </div>
  )
}
