// Regras do quadro Kanban, separadas do componente para serem testadas sem arrastar nada.

export interface ItemQuadro {
  id: string
  posicao: number
  created_at: string
}

/** Itens de cada coluna, por posição; empate fica com o mais antigo. Quem não tem coluna fica de fora. */
export function agrupar<T extends ItemQuadro>(
  itens: T[],
  colunas: readonly { id: string }[],
  colunaDe: (item: T) => string,
): Map<string, T[]> {
  const grupos = new Map<string, T[]>(colunas.map((coluna) => [coluna.id, []]))
  for (const item of itens) grupos.get(colunaDe(item))?.push(item)
  for (const grupo of grupos.values()) {
    grupo.sort((a, b) => a.posicao - b.posicao || a.created_at.localeCompare(b.created_at))
  }
  return grupos
}

/** Posição para entrar no fim de uma coluna. */
export function proximaPosicao(itensDaColuna: { posicao: number }[]): number {
  return itensDaColuna.reduce((maior, item) => Math.max(maior, item.posicao), 0) + 1
}

/** Coluna para onde o card vai ao ser solto; null se não há o que mudar. */
export function destinoDoArraste(
  colunaAtual: string,
  sobre: string | number | null | undefined,
  colunas: readonly { id: string }[],
): string | null {
  if (sobre == null || sobre === colunaAtual) return null
  return colunas.some((coluna) => coluna.id === sobre) ? String(sobre) : null
}
