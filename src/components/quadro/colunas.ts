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

/** Ordem das colunas depois de arrastar `origem` para o lugar de `alvo`; null se nada muda. */
export function reordenarColunas(
  ids: readonly string[],
  origem: string,
  alvo: string | number | null | undefined,
): string[] | null {
  const de = ids.indexOf(origem)
  const para = alvo == null ? -1 : ids.indexOf(String(alvo))
  if (de < 0 || para < 0 || de === para) return null
  const nova = [...ids]
  nova.splice(para, 0, nova.splice(de, 1)[0])
  return nova
}

/** Avanço do card no quadro, de 0 (primeira coluna) a 1 (última). */
export function progressoNoQuadro(coluna: string, colunas: readonly { id: string }[]): number {
  const indice = colunas.findIndex((c) => c.id === coluna)
  return indice <= 0 || colunas.length < 2 ? 0 : indice / (colunas.length - 1)
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

/** Filtro por colaborador: sem ninguém marcado passa tudo; senão, só o que é de alguém marcado. */
export function doColaborador(responsavelId: string | null, selecionados: string[]): boolean {
  return selecionados.length === 0 || (responsavelId != null && selecionados.includes(responsavelId))
}
