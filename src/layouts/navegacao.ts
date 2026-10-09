import type { NomeIcone } from '@/components/ui/Icone'
import { isLideranca } from '@/lib/permissoes'
import type { Cargo } from '@/lib/permissoes'

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

export function tituloDaRota(pathname: string): string {
  const item = ITENS_NAV.find((i) => pathname === i.rota || pathname.startsWith(`${i.rota}/`))
  return item?.rotulo ?? 'SINGLE'
}
