import type { PontoDeMRR } from '@/lib/regras'

/** Respiro entre o desenho e a borda da área do gráfico */
const RESPIRO = 16
/** Altura reservada para uma linha de rótulo de 11 px */
const ROTULO = 16

export interface PontoNoGrafico extends PontoDeMRR {
  x: number
  y: number
}

/**
 * Posição de cada ponto dentro de uma área de `largura` por `altura` pixels.
 * O gráfico é desenhado no tamanho real do card, então ele acompanha a altura do vizinho
 * sem esticar o texto. `topo` e `base` delimitam a faixa onde a linha pode andar; o maior
 * valor encosta em `topo`, e sobra uma linha de rótulo acima e outra abaixo.
 */
export function geometriaDoGrafico(serie: PontoDeMRR[], largura: number, altura: number) {
  const topo = RESPIRO + ROTULO
  const base = altura - RESPIRO - ROTULO
  const maior = Math.max(...serie.map((p) => p.valor), 0) || 1
  const passo = serie.length > 1 ? (largura - RESPIRO * 2) / (serie.length - 1) : 0

  const pontos: PontoNoGrafico[] = serie.map((ponto, i) => ({
    ...ponto,
    x: RESPIRO + passo * i,
    y: base - (ponto.valor / maior) * (base - topo),
  }))
  return { pontos, base, topo }
}

/** Índice do ponto mais perto de uma posição horizontal; null sem pontos. */
export function pontoMaisProximo(pontos: { x: number }[], x: number): number | null {
  if (pontos.length === 0) return null
  let melhor = 0
  for (let i = 1; i < pontos.length; i++) {
    if (Math.abs(pontos[i].x - x) < Math.abs(pontos[melhor].x - x)) melhor = i
  }
  return melhor
}

/** Quanto o último mês mudou em relação ao anterior (0,1 = 10%). Null sem base de comparação. */
export function variacao(serie: { valor: number }[]): number | null {
  if (serie.length < 2) return null
  const anterior = serie[serie.length - 2].valor
  if (anterior === 0) return null
  return (serie[serie.length - 1].valor - anterior) / anterior
}
