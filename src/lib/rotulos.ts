import type { SituacaoDoPagamento } from '@/features/clientes/cartoes'
import type {
  CampaignFuncao,
  CampaignStatus,
  CampaignTaskStatus,
  ClientStatus,
  ContentEtapa,
  PaymentStatus,
  Prioridade,
  SituacaoDoCard,
  TaskStatus,
  TaskTipo,
  TipoConteudo,
  TipoDeOtimizacao,
  TipoEvento,
} from '@/types/database'

export type Tom = 'verde' | 'amarelo' | 'laranja' | 'vermelho' | 'cinza' | 'azul' | 'roxo'

/** As cores de cada tom, as mesmas dos selos (ui.module.css, .pill) */
export const COR_DO_TOM: Record<Tom, string> = {
  verde: '#3ecf8e',
  amarelo: '#e6a630',
  laranja: '#f08a3c',
  vermelho: '#f04444',
  azul: '#4a9eff',
  roxo: '#a855f7',
  cinza: '#8d8d99',
}

/** Cor de uma opção: a escolhida pela equipe ou a do tom de fábrica. */
export function corDe(opcao: { tom: Tom; cor?: string }): string {
  return opcao.cor ?? COR_DO_TOM[opcao.tom]
}

export interface Opcao<T extends string> {
  valor: T
  rotulo: string
  tom: Tom
}

export const STATUS_CLIENTE: readonly Opcao<ClientStatus>[] = [
  { valor: 'ativo', rotulo: 'Ativo', tom: 'verde' },
  { valor: 'pausado', rotulo: 'Pausado', tom: 'amarelo' },
  { valor: 'churn', rotulo: 'Churn', tom: 'vermelho' },
]

export const STATUS_PAGAMENTO: readonly Opcao<PaymentStatus>[] = [
  { valor: 'pendente', rotulo: 'Pendente', tom: 'amarelo' },
  { valor: 'pago', rotulo: 'Pago', tom: 'verde' },
  { valor: 'atrasado', rotulo: 'Atrasado', tom: 'vermelho' },
  { valor: 'cancelado', rotulo: 'Cancelado', tom: 'cinza' },
]

/** Selo da cobrança pelo quanto já entrou. O atraso aparece à parte, como texto. */
export const SITUACOES_PAGAMENTO: readonly Opcao<SituacaoDoPagamento>[] = [
  { valor: 'pago', rotulo: 'Pago', tom: 'verde' },
  { valor: 'parcial', rotulo: 'Parcial', tom: 'amarelo' },
  { valor: 'pendente', rotulo: 'Pendente', tom: 'vermelho' },
]

export const PRIORIDADES: readonly Opcao<Prioridade>[] = [
  { valor: 'baixa', rotulo: 'Baixa', tom: 'cinza' },
  { valor: 'media', rotulo: 'Média', tom: 'azul' },
  { valor: 'alta', rotulo: 'Alta', tom: 'laranja' },
  { valor: 'urgente', rotulo: 'Urgente', tom: 'vermelho' },
]

/** Status do card dentro da coluna. 'feito' é a chave que faz o card andar para a coluna seguinte. */
export const SITUACOES: readonly Opcao<SituacaoDoCard>[] = [
  { valor: 'travado', rotulo: 'Travado', tom: 'vermelho' },
  { valor: 'em_andamento', rotulo: 'Em andamento', tom: 'azul' },
  { valor: 'feito', rotulo: 'Feito', tom: 'verde' },
]

/** Peso para ordenar listas: quanto mais urgente, maior. */
export function pesoDaPrioridade(prioridade: string | null | undefined): number {
  return PRIORIDADES.findIndex((p) => p.valor === (prioridade ?? 'media'))
}

// Cores pedidas no briefing: Conteúdo #4a9eff, Tráfego #e63030, Estratégia #a855f7, Audiovisual #e6a630
export const TIPOS_TAREFA: readonly Opcao<TaskTipo>[] = [
  { valor: 'conteudo', rotulo: 'Conteúdo', tom: 'azul' },
  { valor: 'trafego', rotulo: 'Tráfego', tom: 'vermelho' },
  { valor: 'estrategia', rotulo: 'Estratégia', tom: 'roxo' },
  { valor: 'audiovisual', rotulo: 'Audiovisual', tom: 'amarelo' },
]

/** Colunas do quadro de Demandas. 'arquivado' existe no banco mas não é coluna. */
export const COLUNAS_TAREFA: readonly { id: TaskStatus; titulo: string }[] = [
  { id: 'a_fazer', titulo: 'A Fazer' },
  { id: 'em_andamento', titulo: 'Em Andamento' },
  { id: 'aguardando_aprovacao', titulo: 'Aguardando Aprovação' },
  { id: 'concluido', titulo: 'Concluído' },
]

/** Colunas do quadro de Anúncios: os status que as tarefas de anúncio já tinham. */
export const COLUNAS_ANUNCIO: readonly { id: string; titulo: string }[] = [
  { id: 'pendente', titulo: 'Pendente' },
  { id: 'em_andamento', titulo: 'Em andamento' },
  { id: 'concluido', titulo: 'Concluído' },
]

export const TIPOS_CONTEUDO: readonly Opcao<TipoConteudo>[] = [
  { valor: 'reels', rotulo: 'Reels', tom: 'roxo' },
  { valor: 'carrossel', rotulo: 'Carrossel', tom: 'azul' },
  { valor: 'post', rotulo: 'Post', tom: 'cinza' },
  { valor: 'stories', rotulo: 'Stories', tom: 'amarelo' },
  { valor: 'video', rotulo: 'Vídeo', tom: 'vermelho' },
]

export const COLUNAS_CONTEUDO: readonly { id: ContentEtapa; titulo: string }[] = [
  { id: 'captar_material', titulo: 'Captar Material' },
  { id: 'editar', titulo: 'Editar' },
  { id: 'aguardando_aprovacao', titulo: 'Aguardando Aprovação' },
  { id: 'publicado', titulo: 'Publicado' },
]

export const STATUS_CAMPANHA: readonly Opcao<CampaignStatus>[] = [
  { valor: 'planejamento', rotulo: 'Planejamento', tom: 'cinza' },
  { valor: 'em_execucao', rotulo: 'Em execução', tom: 'verde' },
  { valor: 'pausada', rotulo: 'Pausada', tom: 'amarelo' },
  { valor: 'finalizada', rotulo: 'Finalizada', tom: 'azul' },
]

export const PLATAFORMAS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads', 'Outra'] as const

export const TIPOS_DE_OTIMIZACAO: readonly Opcao<TipoDeOtimizacao>[] = [
  { valor: 'orcamento', rotulo: 'Orçamento', tom: 'verde' },
  { valor: 'criativo', rotulo: 'Criativo', tom: 'roxo' },
  { valor: 'segmentacao', rotulo: 'Segmentação', tom: 'azul' },
  { valor: 'pausar', rotulo: 'Pausar', tom: 'amarelo' },
  { valor: 'desativar', rotulo: 'Desativar', tom: 'vermelho' },
  { valor: 'nota', rotulo: 'Nota', tom: 'cinza' },
]

export const FUNCOES_CAMPANHA: readonly { valor: CampaignFuncao; rotulo: string }[] = [
  { valor: 'copy', rotulo: 'Copy' },
  { valor: 'criativos', rotulo: 'Criativos' },
  { valor: 'captacao_material', rotulo: 'Captação de Material' },
  { valor: 'trafego', rotulo: 'Tráfego' },
  { valor: 'estrategia', rotulo: 'Estratégia' },
]

export const STATUS_TAREFA_CAMPANHA: readonly Opcao<CampaignTaskStatus>[] = [
  { valor: 'pendente', rotulo: 'Pendente', tom: 'cinza' },
  { valor: 'em_andamento', rotulo: 'Em andamento', tom: 'amarelo' },
  { valor: 'concluido', rotulo: 'Concluído', tom: 'verde' },
]

// Cores pedidas: reunião azul, gravação roxo, entrega vermelho, otimização laranja, outro cinza
export const TIPOS_EVENTO: readonly Opcao<TipoEvento>[] = [
  { valor: 'reuniao', rotulo: 'Reunião', tom: 'azul' },
  { valor: 'gravacao', rotulo: 'Gravação', tom: 'roxo' },
  { valor: 'entrega', rotulo: 'Entrega', tom: 'vermelho' },
  { valor: 'otimizacao', rotulo: 'Otimização', tom: 'laranja' },
  { valor: 'outro', rotulo: 'Outro', tom: 'cinza' },
]

export function opcao<T extends string>(lista: readonly Opcao<T>[], valor: T): Opcao<T> {
  return lista.find((o) => o.valor === valor) ?? { valor, rotulo: valor, tom: 'cinza' }
}
