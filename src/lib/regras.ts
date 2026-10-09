import type { Campaign, Client, ClientPayment, ContentCard, Task } from '@/types/database'
import { diffDias, somarDias } from './datas'
import { formatarData } from './formato'

export function tarefaAberta(tarefa: Pick<Task, 'status'>): boolean {
  return tarefa.status !== 'concluido' && tarefa.status !== 'arquivado'
}

export function tarefaAtrasada(tarefa: Pick<Task, 'status' | 'data_entrega'>, hoje: string): boolean {
  return tarefaAberta(tarefa) && tarefa.data_entrega != null && tarefa.data_entrega < hoje
}

export function diasDeAtraso(dataISO: string, hoje: string): number {
  return Math.max(0, diffDias(dataISO, hoje))
}

/** Tarefas abertas com prazo vencido ou dentro dos próximos `dias`, da mais urgente para a menos. */
export function proximasEntregas(tarefas: Task[], hoje: string, dias = 7): Task[] {
  const limite = somarDias(hoje, dias)
  return tarefas
    .filter((t) => tarefaAberta(t) && t.data_entrega != null && t.data_entrega <= limite)
    .sort((a, b) => (a.data_entrega as string).localeCompare(b.data_entrega as string))
}

export function otimizacaoPendente(
  campanha: Pick<Campaign, 'status' | 'proxima_otimizacao'>,
  hoje: string,
): boolean {
  return (
    campanha.status === 'em_execucao' &&
    campanha.proxima_otimizacao != null &&
    campanha.proxima_otimizacao <= hoje
  )
}

/** Campanhas em execução com otimização vencida ou dentro dos próximos `dias`, da mais urgente para a menos. */
export function proximasOtimizacoes(campanhas: Campaign[], hoje: string, dias = 3): Campaign[] {
  const limite = somarDias(hoje, dias)
  return campanhas
    .filter(
      (c) =>
        c.status === 'em_execucao' && c.proxima_otimizacao != null && c.proxima_otimizacao <= limite,
    )
    .sort((a, b) => (a.proxima_otimizacao as string).localeCompare(b.proxima_otimizacao as string))
}

/** Ao registrar uma otimização, a próxima fica para dali a dois dias. */
export function dataAposOtimizar(hoje: string): string {
  return somarDias(hoje, 2)
}

export function pagamentoAtrasado(
  pagamento: Pick<ClientPayment, 'status' | 'data_vencimento'>,
  hoje: string,
): boolean {
  if (pagamento.status === 'pago') return false
  return pagamento.status === 'atrasado' || pagamento.data_vencimento < hoje
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

export function formatarFidelidade(meses: number): string {
  if (meses < 1) return 'menos de 1 mês'
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  if (anos === 0) return plural(resto, 'mês', 'meses')
  if (resto === 0) return plural(anos, 'ano', 'anos')
  return `${plural(anos, 'ano', 'anos')} e ${plural(resto, 'mês', 'meses')}`
}

export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const minutos = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 30) return `há ${plural(dias, 'dia', 'dias')}`
  return formatarData(iso)
}

/** Converte "1.500,50", "R$ 2.000" ou "1500.5" em número. Null se inválido ou negativo. */
export function parseMoeda(texto: string): number | null {
  let limpo = texto.replace(/R\$/i, '').replace(/\s/g, '')
  if (limpo === '') return null
  if (limpo.includes(',')) {
    limpo = limpo.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
    limpo = limpo.replace(/\./g, '')
  }
  if (!/^\d+(\.\d+)?$/.test(limpo)) return null
  return Number(limpo)
}

export interface Metricas {
  mrrTotal: number
  clientesAtivos: number
  tarefasAbertas: number
  conteudosAguardando: number
}

export function calcularMetricas(
  clientes: Pick<Client, 'status' | 'mrr'>[],
  tarefas: Pick<Task, 'status'>[],
  cards: Pick<ContentCard, 'etapa'>[],
): Metricas {
  const ativos = clientes.filter((c) => c.status === 'ativo')
  return {
    mrrTotal: ativos.reduce((soma, c) => soma + Number(c.mrr), 0),
    clientesAtivos: ativos.length,
    tarefasAbertas: tarefas.filter(tarefaAberta).length,
    conteudosAguardando: cards.filter((c) => c.etapa === 'aguardando_aprovacao').length,
  }
}
