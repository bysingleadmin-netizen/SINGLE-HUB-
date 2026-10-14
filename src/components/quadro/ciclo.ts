// Ciclo de vida dos cards concluídos.
//
// Um card está concluído quando chega à última coluna do quadro (arrastado, pelo menu de
// status "Feito" ou pelo painel). Nesse momento ganha `concluded_at`.
//   * Por 7 dias ele continua visível na coluna.
//   * Depois disso vai para Arquivados, que fica oculto até alguém pedir para ver.
//   * 30 dias depois de arquivado, é excluído de vez.
//
// O arquivamento e a exclusão são feitos no banco, por uma rotina diária agendada com pg_cron
// (função public.limpar_cards, migration 0003). A tela não espera a rotina para esconder um
// card vencido: ela faz a mesma conta com `concluded_at`. Excluir, só o banco exclui.
// Arquivar à mão continua existindo e segue o mesmo prazo de exclusão.

export const DIAS_VISIVEL = 7
export const DIAS_ARQUIVADO = 30

const MS_POR_DIA = 86_400_000

interface ComCiclo {
  concluded_at?: string | null
  archived_at?: string | null
}

/** Concluído há mais de 7 dias: já deveria estar em Arquivados, mesmo que a rotina não tenha passado. */
export function venceuOPrazoVisivel(item: ComCiclo, agora: Date = new Date()): boolean {
  if (!item.concluded_at) return false
  return agora.getTime() - new Date(item.concluded_at).getTime() >= DIAS_VISIVEL * MS_POR_DIA
}

/** Dias que faltam para o card arquivado ser excluído; null se a data de arquivamento não é conhecida. */
export function diasParaExcluir(item: ComCiclo, agora: Date = new Date()): number | null {
  // Card escondido pela conta da tela ainda não tem archived_at: o prazo conta do fim dos 7 dias
  const inicio = item.archived_at
    ? new Date(item.archived_at).getTime()
    : item.concluded_at
      ? new Date(item.concluded_at).getTime() + DIAS_VISIVEL * MS_POR_DIA
      : null
  if (inicio == null) return null
  return Math.max(0, Math.ceil((inicio + DIAS_ARQUIVADO * MS_POR_DIA - agora.getTime()) / MS_POR_DIA))
}

/** Datas a gravar junto quando o card muda de coluna. */
export function datasDoCiclo(
  destino: string,
  ultimaColuna: string | undefined,
  agora: Date = new Date(),
): ComCiclo {
  const instante = agora.toISOString()
  // Arquivar à mão não mexe na data de conclusão: o card pode nem ter sido concluído
  if (destino === 'arquivado') return { archived_at: instante }
  if (destino === ultimaColuna) return { concluded_at: instante, archived_at: null }
  // Voltou a ser trabalho em aberto
  return { concluded_at: null, archived_at: null }
}
