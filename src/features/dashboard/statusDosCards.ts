import { venceuOPrazoVisivel } from '@/components/quadro/ciclo'
import type { OpcaoDeCampo } from '@/dados/opcoes'
import { COR_DO_TOM } from '@/lib/rotulos'
import type { ContentCard, Task } from '@/types/database'

// Distribuição dos status dos cards de Demandas e Conteúdo para o gráfico de rosca do Dashboard.
// Conta o que está nos quadros: arquivados e concluídos há mais de 7 dias ficam de fora,
// como ficam fora das colunas.

export interface FatiaDeStatus {
  valor: string
  rotulo: string
  cor: string
  total: number
}

// Status criados pela equipe não têm cor própria; cada um recebe uma destas, em ordem
const CORES_PERSONALIZADAS = ['#4a9eff', '#a855f7', '#f08a3c', '#2dd4bf', '#f472b6', '#facc15']

export const SEM_STATUS = 'sem_status'

function noQuadro(card: Pick<Task, 'concluded_at' | 'archived_at'>, coluna: string, agora: Date) {
  return coluna !== 'arquivado' && !card.archived_at && !venceuOPrazoVisivel(card, agora)
}

export function contarStatus(
  tarefas: readonly Task[],
  cards: readonly ContentCard[],
  opcoes: readonly OpcaoDeCampo[],
  agora: Date = new Date(),
): FatiaDeStatus[] {
  const contagem = new Map<string, number>()
  const somar = (situacao: string | null | undefined) => {
    const chave = situacao || SEM_STATUS
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }
  for (const tarefa of tarefas) if (noQuadro(tarefa, tarefa.status, agora)) somar(tarefa.situacao)
  for (const card of cards) if (noQuadro(card, card.etapa, agora)) somar(card.situacao)

  let personalizadas = 0
  const fatias: FatiaDeStatus[] = opcoes.map((opcao) => ({
    valor: opcao.valor,
    rotulo: opcao.rotulo,
    // A cor escolhida na engrenagem vale; sem ela, os status criados pela equipe ganham uma cor
    // da paleta em ordem, para não ficarem todos cinza
    cor:
      opcao.cor ??
      (opcao.personalizada || opcao.tom === 'cinza'
        ? CORES_PERSONALIZADAS[personalizadas++ % CORES_PERSONALIZADAS.length]
        : COR_DO_TOM[opcao.tom]),
    total: contagem.get(opcao.valor) ?? 0,
  }))

  // Status que saiu da lista mas ainda está gravado em algum card
  const conhecidos = new Set([...opcoes.map((opcao) => opcao.valor), SEM_STATUS])
  for (const [valor, total] of contagem) {
    if (conhecidos.has(valor)) continue
    fatias.push({
      valor,
      rotulo: valor,
      cor: CORES_PERSONALIZADAS[personalizadas++ % CORES_PERSONALIZADAS.length],
      total,
    })
  }

  fatias.push({
    valor: SEM_STATUS,
    rotulo: 'Sem status',
    cor: COR_DO_TOM.cinza,
    total: contagem.get(SEM_STATUS) ?? 0,
  })
  return fatias
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
