export const CARGOS = [
  'CEO',
  'Founder',
  'Co-Founder',
  'Gestor de Tráfego',
  'Social Media',
  'Designer',
  'Editor de Vídeo',
  'Copywriter',
] as const

export type Cargo = (typeof CARGOS)[number]

const CARGOS_LIDERANCA: readonly Cargo[] = ['CEO', 'Founder', 'Co-Founder']

export function isLideranca(cargo: Cargo | null | undefined): boolean {
  return cargo != null && CARGOS_LIDERANCA.includes(cargo)
}
