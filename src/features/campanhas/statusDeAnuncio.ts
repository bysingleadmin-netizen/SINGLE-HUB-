import { useColunasDoQuadro } from '@/dados/colunas'
import { COLUNAS_ANUNCIO, STATUS_TAREFA_CAMPANHA } from '@/lib/rotulos'
import type { Opcao } from '@/lib/rotulos'
import type { CampaignTaskStatus } from '@/types/database'

/**
 * Status das tarefas de anúncio com os nomes e as colunas do quadro de Anúncios. Assim a lista e
 * a página do anúncio mostram as colunas criadas ou renomeadas pela equipe, e não o código delas.
 */
export function useStatusDeAnuncio(): readonly Opcao<CampaignTaskStatus>[] {
  const { colunas } = useColunasDoQuadro('anuncios', COLUNAS_ANUNCIO)
  return colunas.map((coluna) => ({
    valor: coluna.id,
    rotulo: coluna.titulo,
    tom: STATUS_TAREFA_CAMPANHA.find((s) => s.valor === coluna.id)?.tom ?? 'cinza',
  }))
}
