import type { NomeIcone } from '@/components/ui/Icone'
import { isLideranca } from '@/lib/permissoes'
import type { Cargo } from '@/lib/permissoes'
import { otimizacaoPendente, plural, tarefaAtrasada } from '@/lib/regras'
import type { Campaign, Task } from '@/types/database'

export interface ItemNav {
  rota: string
  rotulo: string
  icone: NomeIcone
  apenasLideranca?: boolean
}

export const ITENS_NAV: readonly ItemNav[] = [
  { rota: '/app/dashboard', rotulo: 'Dashboard', icone: 'dashboard' },
  { rota: '/app/clientes', rotulo: 'Clientes', icone: 'clientes' },
  { rota: '/app/demandas', rotulo: 'Demandas', icone: 'demandas' },
  { rota: '/app/conteudo', rotulo: 'Conteúdo', icone: 'conteudo' },
  { rota: '/app/campanhas', rotulo: 'Campanhas', icone: 'campanhas' },
  { rota: '/app/calendario', rotulo: 'Calendário', icone: 'calendario' },
  { rota: '/app/financeiro', rotulo: 'Financeiro', icone: 'financeiro', apenasLideranca: true },
  { rota: '/app/configuracoes', rotulo: 'Configurações', icone: 'configuracoes' },
]

export function itensVisiveis(cargo: Cargo | null | undefined): ItemNav[] {
  const lideranca = isLideranca(cargo)
  return ITENS_NAV.filter((item) => !item.apenasLideranca || lideranca)
}

/** Por rota: quantas pendências e como lê-las, por exemplo "3 demandas atrasadas". */
export type AvisosDoMenu = Record<string, { total: number; descricao: string }>

/** Demandas com prazo vencido e campanhas com otimização vencida. Rota sem pendência não entra. */
export function avisosDoMenu(
  tarefas: Pick<Task, 'status' | 'data_entrega'>[],
  campanhas: Pick<Campaign, 'status' | 'proxima_otimizacao'>[],
  hoje: string,
): AvisosDoMenu {
  const atrasadas = tarefas.filter((t) => tarefaAtrasada(t, hoje)).length
  const pendentes = campanhas.filter((c) => otimizacaoPendente(c, hoje)).length
  const avisos: AvisosDoMenu = {}
  if (atrasadas > 0) {
    avisos['/app/demandas'] = {
      total: atrasadas,
      descricao: plural(atrasadas, 'demanda atrasada', 'demandas atrasadas'),
    }
  }
  if (pendentes > 0) {
    avisos['/app/campanhas'] = {
      total: pendentes,
      descricao: plural(pendentes, 'otimização pendente', 'otimizações pendentes'),
    }
  }
  return avisos
}

export function tituloDaRota(pathname: string): string {
  const item = ITENS_NAV.find((i) => pathname === i.rota || pathname.startsWith(`${i.rota}/`))
  return item?.rotulo ?? 'SINGLE'
}
