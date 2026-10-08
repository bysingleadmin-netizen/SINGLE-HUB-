// Datas de negócio trafegam como strings 'AAAA-MM-DD', sem horário nem fuso.

const MS_POR_DIA = 86_400_000

function partes(iso: string): [number, number, number] {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  return [ano, mes, dia]
}

function paraISO(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function hojeISO(agora: Date = new Date()): string {
  return paraISO(agora.getFullYear(), agora.getMonth() + 1, agora.getDate())
}

export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = partes(iso)
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return paraISO(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate())
}

/** Dias de `deISO` até `ateISO`; negativo se `ateISO` vier antes. */
export function diffDias(deISO: string, ateISO: string): number {
  const [a1, m1, d1] = partes(deISO)
  const [a2, m2, d2] = partes(ateISO)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / MS_POR_DIA)
}

export function mesesCompletos(inicioISO: string, fimISO: string): number {
  const [a1, m1, d1] = partes(inicioISO)
  const [a2, m2, d2] = partes(fimISO)
  const meses = (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)
  return Math.max(0, meses)
}
