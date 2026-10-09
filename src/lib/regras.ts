import type {
  Campaign,
  CampaignTask,
  Client,
  ClientPayment,
  ContentCard,
  Task,
} from '@/types/database'
import { diffDias, somarDias } from './datas'
import { formatarData } from './formato'

export function tarefaAberta(tarefa: Pick<Task, 'status'>): boolean {
  return tarefa.status !== 'concluido' && tarefa.status !== 'arquivado'
}

export function tarefaAtrasada(tarefa: Pick<Task, 'status' | 'data_entrega'>, hoje: string): boolean {
  return tarefaAberta(tarefa) && tarefa.data_entrega != null && tarefa.data_entrega < hoje
}

export type SituacaoDoPrazo = 'atrasado' | 'proximo' | 'folgado'

/**
 * Cor do indicador de prazo: vencido, vence em até dois dias, ou com folga.
 * Null sem data ou quando o item já foi entregue.
 */
export function situacaoDoPrazo(
  dataEntrega: string | null,
  hoje: string,
  entregue = false,
): SituacaoDoPrazo | null {
  if (!dataEntrega || entregue) return null
  if (dataEntrega < hoje) return 'atrasado'
  return dataEntrega <= somarDias(hoje, 2) ? 'proximo' : 'folgado'
}

/** O prazo em palavras, para o painel de detalhe: "Vence em 2 dias", "3 dias de atraso". */
export function descreverPrazo(dataEntrega: string | null, hoje: string, entregue = false): string {
  if (!dataEntrega) return 'Sem data de entrega'
  if (entregue) return 'Entregue'
  const dias = diffDias(hoje, dataEntrega)
  if (dias < 0) return `${plural(-dias, 'dia', 'dias')} de atraso`
  if (dias === 0) return 'Vence hoje'
  return dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`
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

/** Hora sem os minutos quando é hora cheia: "14h", "14h30". */
function horaCurta(data: Date): string {
  const minutos = data.getMinutes()
  return `${data.getHours()}h${minutos === 0 ? '' : String(minutos).padStart(2, '0')}`
}

function diaLocal(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

/**
 * Quando algo aconteceu, do jeito que se fala: "agora", "há 5 min", "há 2 horas",
 * "ontem às 14h", "03/10 às 9h30".
 */
export function quandoAconteceu(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso)
  const minutos = Math.floor((agora.getTime() - data.getTime()) / 60_000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const dias = diffDias(diaLocal(data), diaLocal(agora))
  if (dias === 0) return `há ${plural(Math.floor(minutos / 60), 'hora', 'horas')}`
  if (dias === 1) return `ontem às ${horaCurta(data)}`
  const [ano, mes, dia] = diaLocal(data).split('-')
  const comAno = ano === String(agora.getFullYear()) ? '' : `/${ano}`
  return `${dia}/${mes}${comAno} às ${horaCurta(data)}`
}

export interface GrupoPorDia<T> {
  /** 'AAAA-MM-DD' no fuso de quem vê */
  dia: string
  /** "Hoje", "Ontem" ou a data */
  rotulo: string
  itens: T[]
}

/** Separa registros por dia, mantendo a ordem em que vieram (mais recentes primeiro). */
export function agruparPorDia<T extends { created_at: string }>(
  registros: T[],
  agora: Date = new Date(),
): GrupoPorDia<T>[] {
  const hoje = diaLocal(agora)
  const grupos: GrupoPorDia<T>[] = []
  for (const registro of registros) {
    const dia = diaLocal(new Date(registro.created_at))
    let grupo = grupos.find((g) => g.dia === dia)
    if (!grupo) {
      const distancia = diffDias(dia, hoje)
      grupo = {
        dia,
        rotulo: distancia === 0 ? 'Hoje' : distancia === 1 ? 'Ontem' : formatarData(dia),
        itens: [],
      }
      grupos.push(grupo)
    }
    grupo.itens.push(registro)
  }
  return grupos
}

export interface CargaDaPessoa {
  id: string
  total: number
  /** Parte do total de itens abertos da equipe, de 0 a 1 */
  fatia: number
}

/**
 * Quantos itens em aberto cada pessoa tem, somando demandas, conteúdos e tarefas de anúncio.
 * Do mais carregado para o menos; quem não tem nada em aberto não entra.
 */
export function cargaPorPessoa(
  tarefas: Pick<Task, 'status' | 'responsavel_id'>[],
  cards: Pick<ContentCard, 'etapa' | 'responsavel_id'>[],
  tarefasDeAnuncio: Pick<CampaignTask, 'status' | 'responsavel_id'>[],
): CargaDaPessoa[] {
  const responsaveis = [
    ...tarefas.filter(tarefaAberta),
    ...cards.filter(cardAberto),
    ...tarefasDeAnuncio.filter((t) => t.status !== 'concluido'),
  ]
    .map((item) => item.responsavel_id)
    .filter((id): id is string => id != null)
  const contagem = new Map<string, number>()
  for (const id of responsaveis) contagem.set(id, (contagem.get(id) ?? 0) + 1)
  return [...contagem]
    .map(([id, total]) => ({ id, total, fatia: total / responsaveis.length }))
    .sort((a, b) => b.total - a.total)
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

/** Conteúdo ainda em produção: nem publicado, nem arquivado. */
export function cardAberto(card: Pick<ContentCard, 'etapa'>): boolean {
  return card.etapa !== 'publicado' && card.etapa !== 'arquivado'
}

/**
 * "Tarefas abertas" soma as três categorias da criação central: demandas, conteúdos em produção
 * e tarefas de anúncio. Contar só as demandas mostrava zero para quem cria tudo pelas outras duas.
 */
export function calcularMetricas(
  clientes: Pick<Client, 'status' | 'mrr'>[],
  tarefas: Pick<Task, 'status'>[],
  cards: Pick<ContentCard, 'etapa'>[],
  tarefasDeAnuncio: Pick<CampaignTask, 'status'>[] = [],
): Metricas {
  const ativos = clientes.filter((c) => c.status === 'ativo')
  return {
    mrrTotal: ativos.reduce((soma, c) => soma + Number(c.mrr), 0),
    clientesAtivos: ativos.length,
    tarefasAbertas:
      tarefas.filter(tarefaAberta).length +
      cards.filter(cardAberto).length +
      tarefasDeAnuncio.filter((t) => t.status !== 'concluido').length,
    conteudosAguardando: cards.filter((c) => c.etapa === 'aguardando_aprovacao').length,
  }
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export interface PontoDeMRR {
  /** 'AAAA-MM' */
  mes: string
  /** 'jan', 'fev'... */
  rotulo: string
  valor: number
}

/**
 * MRR mês a mês, do mais antigo ao atual. O banco não guarda histórico de MRR,
 * então cada mês soma o valor de hoje dos clientes ativos cujo contrato já tinha
 * começado naquele mês. Cliente sem data de início conta em todos.
 */
export function mrrPorMes(
  clientes: Pick<Client, 'status' | 'mrr' | 'data_inicio_contrato'>[],
  hoje: string,
  meses = 6,
): PontoDeMRR[] {
  const ativos = clientes.filter((c) => c.status === 'ativo')
  return ultimosMeses(hoje, meses).map((ponto) => ({
    ...ponto,
    valor: ativos
      .filter((c) => !c.data_inicio_contrato || c.data_inicio_contrato.slice(0, 7) <= ponto.mes)
      .reduce((soma, c) => soma + Number(c.mrr), 0),
  }))
}

/** Os últimos `meses` meses como 'AAAA-MM' com o rótulo curto, do mais antigo ao atual. */
export function ultimosMeses(hoje: string, meses = 6): Omit<PontoDeMRR, 'valor'>[] {
  const [ano, mes] = hoje.split('-').map(Number)
  return Array.from({ length: meses }, (_, i) => {
    const indice = ano * 12 + (mes - 1) - (meses - 1 - i)
    return {
      mes: `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`,
      rotulo: MESES[indice % 12],
    }
  })
}
