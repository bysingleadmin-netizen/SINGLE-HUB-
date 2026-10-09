import type { PontoDeMRR } from '@/lib/regras'

/** Respiro entre o desenho e a borda da área do gráfico */
const RESPIRO = 16
/** Altura reservada para uma linha de rótulo de 11 px */
const ROTULO = 14

export interface PontoNoGrafico extends PontoDeMRR {
  x: number
  y: number
}

/**
 * Posição de cada ponto dentro de uma área de `largura` por `altura` pixels.
 * O gráfico é desenhado no tamanho real do card, então ele acompanha a altura do vizinho
 * sem esticar o texto.
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
  return { pontos, base }
}
