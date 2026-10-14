// Espelha supabase/migrations/0001_schema.sql.
// Datas são strings 'AAAA-MM-DD'; timestamps são ISO 8601.

import type { Cargo } from '@/lib/permissoes'

export type ClientStatus = 'ativo' | 'pausado' | 'churn'
/** 'cancelado' só é aceito pelo banco depois da migration 0003 */
export type PaymentStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado'
// Prioridade, status do card e tipo de conteúdo são listas que a equipe pode editar
// (tabela card_options), então o valor é texto livre. As chaves que o sistema conhece de
// fábrica estão em src/lib/rotulos.ts.
export type Prioridade = string
/** Como o card está dentro da coluna em que se encontra. Só existe depois da migration 0003 */
export type SituacaoDoCard = string
export type FormaDePagamento = 'pix' | 'dinheiro'
export type TaskTipo = 'conteudo' | 'trafego' | 'estrategia' | 'audiovisual'
export type TaskStatus =
  | 'a_fazer'
  | 'em_andamento'
  | 'aguardando_aprovacao'
  | 'concluido'
  | 'arquivado'
export type TipoConteudo = string
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
  /** Duração da fidelidade em meses (3, 6, 12 ou 15). Só existe depois da migration 0004 */
  contrato_meses?: number | null
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
  /** Quanto já entrou. Só existe depois da migration 0004 */
  valor_pago?: number
  /** Data do último recebimento, parcial ou total. Migration 0004 */
  pago_em?: string | null
  observacao_pagamento?: string | null
  /** Valor total editado à mão: a sincronização com o cadastro não o reescreve. Migration 0004 */
  valor_manual?: boolean
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
  /** Quando chegou à última coluna do quadro. Só existe depois da migration 0003 */
  concluded_at?: string | null
  /** Quando foi arquivado. Só existe depois da migration 0003 */
  archived_at?: string | null
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
  concluded_at?: string | null
  archived_at?: string | null
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

/** Subtarefa simples de um card: caixa de marcar e texto (migration 0003). */
export interface CardSubtarefa {
  id: string
  quadro: QuadroId
  card_id: string
  titulo: string
  concluida: boolean
  posicao: number
  created_at: string
}

export type CampoConfiguravel = 'situacao' | 'prioridade' | 'tipo_conteudo'

/** Opção de um dos campos configuráveis dos cards, com o nome que a equipe deu (migration 0003). */
export interface CardOption {
  id: string
  campo: CampoConfiguravel
  /** Valor gravado no card */
  chave: string
  titulo: string
  posicao: number
  /** #rrggbb escolhida na engrenagem. Migration 0004 */
  cor?: string | null
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