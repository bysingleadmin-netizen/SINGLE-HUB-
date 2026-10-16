import { useLayoutEffect, useRef, useState } from 'react'
import { formatarMoeda } from '@/lib/formato'
import styles from './graficos.module.css'

export interface SerieMensal {
  chave: string
  rotulo: string
  cor: string
  /** Cor que depende do valor, como lucro verde e prejuízo vermelho. A legenda mostra as duas */
  corDoValor?: (valor: number) => string
  /** As duas cores da legenda quando há corDoValor: [positivo, negativo] */
  coresDaLegenda?: [string, string]
}

export interface PontoMensal {
  /** 'AAAA-MM' */
  mes: string
  /** 'jan', 'fev'... */
  rotulo: string
  valores: Record<string, number>
}

interface GraficoMensalProps {
  /** O que o gráfico mostra, para leitores de tela */
  titulo: string
  tipo: 'barras' | 'linhas'
  series: SerieMensal[]
  pontos: PontoMensal[]
  formatar?: (valor: number) => string
}

const compacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const MARGEM = { topo: 12, direita: 8, base: 24, esquerda: 64 }

/** Quatro divisões "redondas" do eixo, sempre passando pelo zero */
export function escalaDoEixo(minimo: number, maximo: number): number[] {
  const baixo = Math.min(0, minimo)
  const alto = Math.max(0, maximo)
  const faixa = alto - baixo || 1
  const bruto = faixa / 4
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? bruto
  const marcas: number[] = []
  for (let valor = Math.floor(baixo / passo) * passo; valor <= alto + passo * 0.001; valor += passo) {
    marcas.push(Math.round(valor * 100) / 100)
  }
  if (marcas[marcas.length - 1] < alto) marcas.push(marcas[marcas.length - 1] + passo)
  return marcas
}

/** Barra com as pontas de dado arredondadas e a base reta, no zero */
function caminhoDaBarra(x: number, largura: number, yZero: number, yValor: number): string {
  const altura = Math.abs(yZero - yValor)
  const r = Math.min(4, largura / 2, altura)
  if (yValor <= yZero) {
    return `M${x},${yZero} V${yValor + r} Q${x},${yValor} ${x + r},${yValor} H${x + largura - r} Q${x + largura},${yValor} ${x + largura},${yValor + r} V${yZero} Z`
  }
  return `M${x},${yZero} V${yValor - r} Q${x},${yValor} ${x + r},${yValor} H${x + largura - r} Q${x + largura},${yValor} ${x + largura},${yValor - r} V${yZero} Z`
}

/**
 * Gráfico mês a mês em SVG, do tamanho da caixa: barras agrupadas ou linhas, um eixo só em
 * reais. Passar o mouse sobre um mês mostra os valores de todas as séries dele.
 */
export function GraficoMensal({ titulo, tipo, series, pontos, formatar = formatarMoeda }: GraficoMensalProps) {
  const caixa = useRef<HTMLDivElement>(null)
  const [tamanho, setTamanho] = useState({ largura: 600, altura: 260 })
  const [ativo, setAtivo] = useState<number | null>(null)

  useLayoutEffect(() => {
    const elemento = caixa.current
    if (!elemento || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(([entrada]) => {
      const { width, height } = entrada.contentRect
      if (width > 0 && height > 0) setTamanho({ largura: Math.round(width), altura: Math.round(height) })
    })
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  const { largura, altura } = tamanho
  const todos = pontos.flatMap((ponto) => series.map((serie) => ponto.valores[serie.chave] ?? 0))
  const marcas = escalaDoEixo(Math.min(...todos, 0), Math.max(...todos, 0))
  const piso = marcas[0]
  const teto = marcas[marcas.length - 1]
  const areaAltura = altura - MARGEM.topo - MARGEM.base
  const areaLargura = largura - MARGEM.esquerda - MARGEM.direita
  const y = (valor: number) => MARGEM.topo + ((teto - valor) / (teto - piso || 1)) * areaAltura
  const faixa = areaLargura / Math.max(pontos.length, 1)
  const centro = (i: number) => MARGEM.esquerda + faixa * i + faixa / 2
  const yZero = y(0)
  const corDe = (serie: SerieMensal, valor: number) => serie.corDoValor?.(valor) ?? serie.cor

  // Barras: o grupo ocupa 70% da faixa do mês, com 2px de superfície entre as barras
  const grupo = Math.min(faixa * 0.7, series.length * 28)
  const larguraDaBarra = (grupo - 2 * (series.length - 1)) / series.length
  const destacado = ativo != null ? pontos[ativo] : undefined

  return (
    <figure className={styles.mensal}>
      <ul className={styles.legenda}>
        {series.map((serie) => (
          <li key={serie.chave}>
            {serie.coresDaLegenda ? (
              <span
                className={styles.legendaCor}
                style={{ background: `linear-gradient(135deg, ${serie.coresDaLegenda[0]} 50%, ${serie.coresDaLegenda[1]} 50%)` }}
                aria-hidden="true"
              />
            ) : (
              <span className={styles.legendaCor} style={{ background: serie.cor }} aria-hidden="true" />
            )}
            {serie.rotulo}
          </li>
        ))}
      </ul>
      <div ref={caixa} className={styles.mensalArea} onMouseLeave={() => setAtivo(null)}>
        <svg viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true">
          {marcas.map((marca) => (
            <g key={marca}>
              <line
                className={marca === 0 ? styles.mensalZero : styles.mensalGrade}
                x1={MARGEM.esquerda}
                x2={largura - MARGEM.direita}
                y1={y(marca)}
                y2={y(marca)}
              />
              <text className={styles.mensalRotulo} x={MARGEM.esquerda - 8} y={y(marca) + 4} textAnchor="end">
                {compacto.format(marca)}
              </text>
            </g>
          ))}
          {destacado && ativo != null && (
            <rect
              className={styles.mensalFaixa}
              x={MARGEM.esquerda + faixa * ativo}
              y={MARGEM.topo}
              width={faixa}
              height={areaAltura}
              rx={4}
            />
          )}

          {tipo === 'barras' &&
            pontos.map((ponto, i) =>
              series.map((serie, j) => {
                const valor = ponto.valores[serie.chave] ?? 0
                if (valor === 0) return null
                const x = centro(i) - grupo / 2 + j * (larguraDaBarra + 2)
                return (
                  <path
                    key={`${ponto.mes}-${serie.chave}`}
                    d={caminhoDaBarra(x, larguraDaBarra, yZero, y(valor))}
                    fill={corDe(serie, valor)}
                  />
                )
              }),
            )}

          {tipo === 'linhas' &&
            series.map((serie) => (
              <g key={serie.chave}>
                {pontos.slice(1).map((ponto, k) => {
                  const anterior = pontos[k]
                  const a = anterior.valores[serie.chave] ?? 0
                  const b = ponto.valores[serie.chave] ?? 0
                  const x1 = centro(k)
                  const x2 = centro(k + 1)
                  // Trecho que cruza o zero muda de cor exatamente no zero
                  if (serie.corDoValor && a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b)) {
                    const xZero = x1 + ((x2 - x1) * a) / (a - b)
                    return (
                      <g key={ponto.mes}>
                        <line className={styles.mensalLinha} x1={x1} y1={y(a)} x2={xZero} y2={yZero} stroke={corDe(serie, a)} />
                        <line className={styles.mensalLinha} x1={xZero} y1={yZero} x2={x2} y2={y(b)} stroke={corDe(serie, b)} />
                      </g>
                    )
                  }
                  return (
                    <line
                      key={ponto.mes}
                      className={styles.mensalLinha}
                      x1={x1}
                      y1={y(a)}
                      x2={x2}
                      y2={y(b)}
                      stroke={corDe(serie, (a + b) / 2)}
                    />
                  )
                })}
                {pontos.map((ponto, i) => {
                  const valor = ponto.valores[serie.chave] ?? 0
                  return (
                    <circle
                      key={ponto.mes}
                      className={styles.mensalPonto}
                      cx={centro(i)}
                      cy={y(valor)}
                      r={i === ativo ? 5 : 4}
                      stroke={corDe(serie, valor)}
                      fill={i === ativo ? corDe(serie, valor) : undefined}
                    />
                  )
                })}
              </g>
            ))}

          {pontos.map((ponto, i) => (
            <text key={ponto.mes} className={styles.mensalRotulo} x={centro(i)} y={altura - 6} textAnchor="middle">
              {/* Muitos meses no celular: um rótulo sim, outro não, a partir do último */}
              {faixa >= 34 || (pontos.length - 1 - i) % 2 === 0 ? ponto.rotulo : ''}
            </text>
          ))}

          {/* Alvos do mouse: a faixa inteira do mês, maior que a marca */}
          {pontos.map((ponto, i) => (
            <rect
              key={ponto.mes}
              className={styles.mensalAlvo}
              x={MARGEM.esquerda + faixa * i}
              y={0}
              width={faixa}
              height={altura}
              onMouseEnter={() => setAtivo(i)}
            />
          ))}
        </svg>
        {destacado && ativo != null && (
          <div
            className={styles.mensalDica}
            role="presentation"
            style={{ left: Math.min(Math.max(centro(ativo), 90), largura - 90) }}
          >
            <span className={styles.mensalDicaMes}>{destacado.rotulo}</span>
            {series.map((serie) => {
              const valor = destacado.valores[serie.chave] ?? 0
              return (
                <span key={serie.chave} className={styles.mensalDicaLinha}>
                  <span className={styles.legendaCor} style={{ background: corDe(serie, valor) }} aria-hidden="true" />
                  {serie.rotulo}
                  <strong>{formatar(valor)}</strong>
                </span>
              )
            })}
          </div>
        )}
      </div>
      {/* A tabela ignora largura de 1px: quem fica escondido é o div em volta */}
      <div className={styles.somenteLeitor}>
        <table>
          <caption>{titulo}</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              {series.map((serie) => (
                <th key={serie.chave} scope="col">
                  {serie.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pontos.map((ponto) => (
              <tr key={ponto.mes}>
                <th scope="row">{ponto.rotulo}</th>
                {series.map((serie) => (
                  <td key={serie.chave}>{formatar(ponto.valores[serie.chave] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
