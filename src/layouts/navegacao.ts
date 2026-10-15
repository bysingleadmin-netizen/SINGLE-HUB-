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
  /** Itens com o mesmo grupo aparecem juntos no menu, sob um cabeçalho só */
  grupo?: string
}

export const ITENS_NAV: readonly ItemNav[] = [
  { rota: '/app/dashboard', rotulo: 'Dashboard', icone: 'dashboard' },
  { rota: '/app/clientes', rotulo: 'Clientes', icone: 'clientes' },
  // Os quatro quadros de produção ficam sob um cabeçalho só; cada um tem colunas próprias.
  // As rotas continuam as mesmas, então links e notificações antigos seguem valendo.
  { rota: '/app/tarefas', rotulo: 'Tarefas', icone: 'confirmar', grupo: 'Produção' },
  { rota: '/app/demandas', rotulo: 'Demandas', icone: 'demandas', grupo: 'Produção' },
  { rota: '/app/conteudo', rotulo: 'Conteúdo', icone: 'conteudo', grupo: 'Produção' },
  { rota: '/app/anuncios', rotulo: 'Anúncios', icone: 'campanhas', grupo: 'Produção' },
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

/** Demandas e tarefas com prazo vencido, cada uma no seu quadro, e campanhas com otimização vencida. Rota sem pendência não entra. */
export function avisosDoMenu(
  tarefas: Pick<Task, 'status' | 'data_entrega' | 'quadro'>[],
  campanhas: Pick<Campaign, 'status' | 'proxima_otimizacao'>[],
  hoje: string,
): AvisosDoMenu {
  const atrasadasNo = (quadro: string) =>
    tarefas.filter((t) => (t.quadro ?? 'demandas') === quadro && tarefaAtrasada(t, hoje)).length
  const atrasadas = atrasadasNo('demandas')
  const internas = atrasadasNo('tarefas')
  const pendentes = campanhas.filter((c) => otimizacaoPendente(c, hoje)).length
  const avisos: AvisosDoMenu = {}
  if (internas > 0) {
    avisos['/app/tarefas'] = {
      total: internas,
      descricao: plural(internas, 'tarefa atrasada', 'tarefas atrasadas'),
    }
  }
  if (atrasadas > 0) {
    avisos['/app/demandas'] = {
      total: atrasadas,
      descricao: plural(atrasadas, 'demanda atrasada', 'demandas atrasadas'),
    }
  }
  if (pendentes > 0) {
    avisos['/app/anuncios'] = {
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
