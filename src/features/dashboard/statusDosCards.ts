import { venceuOPrazoVisivel } from '@/components/quadro/ciclo'
import type { ColunaDoQuadro } from '@/dados/colunas'
import { COR_DO_TOM } from '@/lib/rotulos'
import { cardAberto, tarefaAtrasada } from '@/lib/regras'
import type { ContentCard, Task } from '@/types/database'

// Cards de cada quadro por coluna, para as roscas do Dashboard. O status de um card é a coluna
// em que ele está (tasks.status, content_cards.etapa). Conta o que está nos quadros:
// arquivados e concluídos há mais de 7 dias ficam de fora, como ficam fora das colunas.

export interface FatiaDeStatus {
  valor: string
  rotulo: string
  cor: string
  total: number
}

// Uma cor por coluna, na ordem do quadro; a coluna de entregue fica verde
const CORES = ['#4a9eff', '#f08a3c', '#a855f7', '#facc15', '#2dd4bf', '#f472b6']
const ENTREGUE = new Set(['concluido', 'publicado'])

type NoQuadro = Pick<Task, 'concluded_at' | 'archived_at'>

function noQuadro(card: NoQuadro, coluna: string, agora: Date) {
  return coluna !== 'arquivado' && !card.archived_at && !venceuOPrazoVisivel(card, agora)
}

/** Quantos cards há em cada coluna, na ordem do quadro e com os nomes que a equipe deu. */
export function contarPorColuna<T extends NoQuadro>(
  itens: readonly T[],
  colunas: readonly ColunaDoQuadro[],
  colunaDe: (item: T) => string,
  agora: Date = new Date(),
): FatiaDeStatus[] {
  const contagem = new Map<string, number>()
  for (const item of itens) {
    const coluna = colunaDe(item)
    if (noQuadro(item, coluna, agora)) contagem.set(coluna, (contagem.get(coluna) ?? 0) + 1)
  }

  let cor = 0
  const proximaCor = () => CORES[cor++ % CORES.length]
  const fatias: FatiaDeStatus[] = colunas.map((coluna) => ({
    valor: coluna.id,
    rotulo: coluna.titulo,
    cor: ENTREGUE.has(coluna.id) ? COR_DO_TOM.verde : proximaCor(),
    total: contagem.get(coluna.id) ?? 0,
  }))

  // Card numa coluna que saiu do quadro: continua contado, com a chave como nome
  const conhecidas = new Set(colunas.map((coluna) => coluna.id))
  for (const [valor, total] of contagem) {
    if (!conhecidas.has(valor)) fatias.push({ valor, rotulo: valor, cor: COR_DO_TOM.cinza, total })
  }
  return fatias
}

/** Demandas, tarefas e conteúdos em aberto com o prazo de entrega vencido. */
export function cardsAtrasados(
  tarefas: readonly Pick<Task, 'status' | 'data_entrega'>[],
  cards: readonly Pick<ContentCard, 'etapa' | 'data_entrega'>[],
  hoje: string,
): number {
  return (
    tarefas.filter((tarefa) => tarefaAtrasada(tarefa, hoje)).length +
    cards.filter((card) => cardAberto(card) && card.data_entrega != null && card.data_entrega < hoje).length
  )
}

export interface ArcoDaRosca extends FatiaDeStatus {
  /** Fração do total, de 0 a 1 */
  fracao: number
  /** Onde o arco começa, em fração da volta */
  inicio: number
}

/** Arcos das fatias que têm card, em sequência a partir do topo. */
export function arcosDaRosca(fatias: readonly FatiaDeStatus[]): ArcoDaRosca[] {
  const total = fatias.reduce((soma, fatia) => soma + fatia.total, 0)
  if (total === 0) return []
  let inicio = 0
  return fatias
    .filter((fatia) => fatia.total > 0)
    .map((fatia) => {
      const fracao = fatia.total / total
      const arco = { ...fatia, fracao, inicio }
      inicio += fracao
      return arco
    })
}
