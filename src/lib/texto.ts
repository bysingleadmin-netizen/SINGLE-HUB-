/** Minúsculas e sem acentos, para comparar texto digitado: "Clínica" vira "clinica". */
export function semAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
