export const CARGOS = [
  'Liderança',
  'Gestor de Tráfego',
  'SDR',
  'Closer',
  'Estrategista & Analista',
  'Colaborador',
] as const

export type Cargo = (typeof CARGOS)[number]

/**
 * Os cargos de antes da migration 0010, que podem continuar no banco até ela rodar: a liderança
 * de antes é a Liderança, e as funções de produção viraram Colaborador.
 */
const CARGOS_ANTIGOS: Record<string, Cargo> = {
  CEO: 'Liderança',
  Founder: 'Liderança',
  'Co-Founder': 'Liderança',
  'Social Media': 'Colaborador',
  Designer: 'Colaborador',
  'Editor de Vídeo': 'Colaborador',
  Copywriter: 'Colaborador',
}

/** O cargo na lista atual. Cargo desconhecido conta como Colaborador, o de menos acesso. */
export function normalizarCargo(cargo: string | null | undefined): Cargo | null {
  if (cargo == null) return null
  if ((CARGOS as readonly string[]).includes(cargo)) return cargo as Cargo
  return CARGOS_ANTIGOS[cargo] ?? 'Colaborador'
}

export function isLideranca(cargo: string | null | undefined): boolean {
  return normalizarCargo(cargo) === 'Liderança'
}

/** Áreas do sistema que dependem do cargo. Cada uma é um item do menu e uma rota. */
export type Area =
  | 'dashboard'
  | 'clientes'
  | 'crm'
  | 'demandas'
  | 'conteudo'
  | 'anuncios'
  | 'calendario'
  | 'financeiro'
  | 'configuracoes'

const TODOS: readonly Cargo[] = CARGOS

/** Quem vê cada área. Dashboard, Demandas, Conteúdo e Calendário são de todos. */
const ACESSO: Record<Area, readonly Cargo[]> = {
  dashboard: TODOS,
  clientes: ['Liderança'],
  crm: ['Liderança', 'SDR', 'Closer'],
  demandas: TODOS,
  conteudo: TODOS,
  anuncios: ['Liderança', 'Gestor de Tráfego', 'Estrategista & Analista'],
  calendario: TODOS,
  financeiro: ['Liderança'],
  configuracoes: ['Liderança'],
}

export function podeAcessar(cargo: string | null | undefined, area: Area): boolean {
  const normalizado = normalizarCargo(cargo)
  return normalizado != null && ACESSO[area].includes(normalizado)
}
