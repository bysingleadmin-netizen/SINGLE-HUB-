// Espelha supabase/migrations/0001_schema.sql.
// Datas são strings 'AAAA-MM-DD'; timestamps são ISO 8601.

import type { Cargo } from '@/lib/permissoes'

export type ClientStatus = 'ativo' | 'pausado' | 'churn'
/** 'cancelado' só é aceito pelo banco depois da migration 0003 */
export type PaymentStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado'
export type Prioridade = 'baixa' | 'media' | 'alta' | 'urgente'
/** Como o card está dentro da coluna em que se encontra. Só existe depois da migration 0003 */
export type SituacaoDoCard = 'travado' | 'em_andamento' | 'feito'
export type FormaDePagamento = 'pix' | 'dinheiro'
export type TaskTipo = 'conteudo' | 'trafego' | 'estrategia' | 'audiovisual'
export type TaskStatus =
  | 'a_fazer'
  | 'em_andamento'
  | 'aguardando_aprovacao'
  | 'concluido'
  | 'arquivado'
export type TipoConteudo = 'reels' | 'carrossel' | 'post' | 'stories' | 'video'
export type ContentEtapa =
  | 'captar_material'
  | 'editar'
  | 'aguardando_aprovacao'
  | 'publicado'
  | 'arquivado'
export type CampaignStatus = 'planejamento' | 'em_execucao' | 'pausada' | 'finalizada'
export type CampaignFuncao = 'copy' | 'criativos' | 'captacao_material' | 'trafego' | 'estrategia'
export type CampaignTaskStatus = 'pendente' | 'em_andamento' | 'concluido'

export interface Profile {
  id: string
  nome: string
  email: string
  cargo: Cargo
  avatar_url: string | null
  created_at: string
}

export interface Client {
  id: string
  nome: string
  logo_url: string | null
  status: ClientStatus
  mrr: number
  data_inicio_contrato: string | null
  /** Dia do mês, 1 a 31. Só existe depois da migration 0002 */
  dia_vencimento?: number | null
  instagram: string | null
  link_conta_anuncios: string | null
  contato_nome: string | null
  contato_email: string | null
  contato_telefone: string | null
  observacoes: string | null
  created_at: string
}

export interface ClientPayment {
  id: string
  client_id: string
  mes_referencia: string
  valor: number
  data_vencimento: string
  data_pagamento: string | null
  status: PaymentStatus
  /** Só existe depois da migration 0002 */
  forma_pagamento?: FormaDePagamento | null
  /** Pago e guardado no histórico. Só existe depois da migration 0003 */
  arquivado?: boolean
  created_at: string
}

export interface Task {
  id: string
  titulo: string
  descricao: string | null
  client_id: string | null
  responsavel_id: string | null
  tipo: TaskTipo
  status: TaskStatus
  data_entrega: string | null
  /** Sem valor conta como 'media' */
  prioridade?: Prioridade | null
  situacao?: SituacaoDoCard | null
  posicao: number
  created_by: string | null
  created_at: string
}

export interface ContentCard {
  id: string
  titulo: string
  tipo_conteudo: TipoConteudo
  client_id: string | null
  responsavel_id: string | null
  etapa: ContentEtapa
  data_entrega: string | null
  /** Só existe depois da migration 0003; sem valor conta como 'media' */
  prioridade?: Prioridade | null
  situacao?: SituacaoDoCard | null
  observacoes: string | null
  posicao: number
  created_at: string
}

export interface Campaign {
  id: string
  nome: string
  client_id: string
  status: CampaignStatus
  data_inicio: string | null
  data_fim: string | null
  orcamento: number
  estrategia: string | null
  proxima_otimizacao: string | null
  created_at: string
}

export interface CampaignTask {
  id: string
  campaign_id: string
  funcao: CampaignFuncao
  titulo: string
  status: CampaignTaskStatus
  responsavel_id: string | null
  created_at: string
}

export interface Expense {
  id: string
  descricao: string
  categoria: string
  valor: number
  data: string
  forma_pagamento: string
  created_by: string | null
  created_at: string
}

export interface MonthlyGoal {
  id: string
  mes: string
  meta: number
  created_at: string
}

export interface TrafficMetric {
  id: string
  mes: string
  investimento: number
  leads_instagram: number
  leads_whatsapp: number
  convertidos: number
  created_at: string
}

export interface ActivityLog {
  id: string
  user_id: string | null
  acao: string
  descricao: string
  entidade: string | null
  entidade_id: string | null
  created_at: string
}

export type TipoEvento = 'reuniao' | 'gravacao' | 'entrega' | 'otimizacao' | 'outro'

export interface CalendarEvent {
  id: string
  titulo: string
  descricao: string | null
  tipo: TipoEvento
  /** Timestamps ISO 8601, com fuso */
  data_inicio: string
  data_fim: string | null
  dia_inteiro: boolean
  client_id: string | null
  created_by: string | null
  created_at: string
}

export interface EventParticipant {
  event_id: string
  profile_id: string
}

export type TipoNotificacao = 'tarefa' | 'evento' | 'prazo'

/** Linha de `notifications`. O nome evita confusão com a Notification do navegador. */
export interface Notificacao {
  id: string
  user_id: string
  tipo: TipoNotificacao
  titulo: string
  mensagem: string | null
  link: string | null
  lida: boolean
  created_at: string
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string | null
  conteudo: string
  created_at: string
}

export type QuadroId = 'demandas' | 'conteudo'

/** Link ou imagem anexados a um card de Demandas ou de Conteúdo (migration 0003). */
export interface CardAttachment {
  id: string
  quadro: QuadroId
  card_id: string
  tipo: 'link' | 'imagem'
  url: string
  nome: string | null
  created_by: string | null
  created_at: string
}

/** Coluna de um quadro Kanban com nome e ordem definidos pela equipe (migration 0003). */
export interface BoardColumn {
  id: string
  quadro: QuadroId
  /** Valor gravado em tasks.status ou content_cards.etapa */
  chave: string
  titulo: string
  posicao: number
  created_at: string
}