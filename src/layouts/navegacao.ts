import type { NomeIcone } from '@/components/ui/Icone'
import { podeAcessar } from '@/lib/permissoes'
import type { Area } from '@/lib/permissoes'
import { otimizacaoPendente, plural, tarefaAtrasada } from '@/lib/regras'
import type { Campaign, Task } from '@/types/database'

export interface ItemNav {
  rota: string
  rotulo: string
  icone: NomeIcone
  /** Quem vê o item depende do cargo (src/lib/permissoes.ts) */
  area: Area
  /** Itens com o mesmo grupo aparecem juntos no menu, sob um cabeçalho só */
  grupo?: string
}

export const ITENS_NAV: readonly ItemNav[] = [
  { rota: '/app/dashboard', rotulo: 'Dashboard', icone: 'dashboard', area: 'dashboard' },
  { rota: '/app/clientes', rotulo: 'Clientes', icone: 'clientes', area: 'clientes' },
  { rota: '/app/crm', rotulo: 'CRM', icone: 'usuario', area: 'crm' },
  // Os quadros de produção ficam sob um cabeçalho só; cada um tem colunas próprias
  { rota: '/app/demandas', rotulo: 'Demandas', icone: 'demandas', area: 'demandas', grupo: 'Produção' },
  { rota: '/app/conteudo', rotulo: 'Conteúdo', icone: 'conteudo', area: 'conteudo', grupo: 'Produção' },
  { rota: '/app/anuncios', rotulo: 'Anúncios', icone: 'campanhas', area: 'anuncios', grupo: 'Produção' },
  { rota: '/app/calendario', rotulo: 'Calendário', icone: 'calendario', area: 'calendario' },
  { rota: '/app/financeiro', rotulo: 'Financeiro', icone: 'financeiro', area: 'financeiro' },
  { rota: '/app/configuracoes', rotulo: 'Configurações', icone: 'configuracoes', area: 'configuracoes' },
]

export function itensVisiveis(cargo: string | null | undefined): ItemNav[] {
  return ITENS_NAV.filter((item) => podeAcessar(cargo, item.area))
}

/** Por rota: quantas pendências e como lê-las, por exemplo "3 demandas atrasadas". */
export type AvisosDoMenu = Record<string, { total: number; descricao: string }>

/** Demandas com prazo vencido e campanhas com otimização vencida. Rota sem pendência não entra. */
export function avisosDoMenu(
  tarefas: Pick<Task, 'status' | 'data_entrega' | 'quadro'>[],
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
    avisos['/app/anuncios'] = {
      total: pendentes,
      descricao: plural(pendentes, 'otimização pendente', 'otimizações pendentes'),
    }
  }
  return avisos
}

// O botão Criar faz sentido onde se gerencia tarefa; no Financeiro, no Dashboard e nas
// configurações ele só confundia.
const ROTAS_COM_CRIAR = ['/app/demandas', '/app/conteudo', '/app/anuncios']

export function mostraCriar(pathname: string): boolean {
  return ROTAS_COM_CRIAR.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))
}

export function tituloDaRota(pathname: string): string {
  const item = ITENS_NAV.find((i) => pathname === i.rota || pathname.startsWith(`${i.rota}/`))
  return item?.rotulo ?? 'SINGLE'
}
