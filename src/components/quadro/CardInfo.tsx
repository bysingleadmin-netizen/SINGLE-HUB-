import type { ReactNode } from 'react'
import { BlocoDeVinculo } from '@/components/ui/BlocoDeVinculo'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import type { OpcaoDeCampo } from '@/dados/opcoes'
import type { ResumoDeSubtarefas } from '@/dados/subtarefas'
import { formatarData } from '@/lib/formato'
import type { SituacaoDoPrazo } from '@/lib/regras'
import type { Client, Profile } from '@/types/database'
import styles from './quadro.module.css'
import { normalizarCargo } from '@/lib/permissoes'

interface CardInfoProps {
  titulo: string
  /** Linha curta abaixo do título, como a função da tarefa de anúncio */
  legenda?: string
  /** Pill com o tipo da demanda ou do conteúdo */
  etiqueta: ReactNode
  cliente: Client | undefined
  /** Todos os responsáveis do card, o principal primeiro */
  responsaveis: Profile[]
  dataEntrega: string | null
  /** Define a cor do indicador de prazo; null deixa neutro */
  prazo: SituacaoDoPrazo | null
  /** Opção de prioridade a mostrar; a página omite a média, para o card não ficar carregado */
  prioridade?: OpcaoDeCampo
  /** Andamento das subtarefas do card */
  subtarefas?: ResumoDeSubtarefas
  /** Quantos comentários a demanda tem */
  comentarios?: number
  /** Avanço no quadro, de 0 a 1 */
  progresso?: number
}

/**
 * Miolo dos cards de Demandas, Conteúdo e Anúncios.
 * Hierarquia: título; depois o bloco com a empresa em cima e os responsáveis embaixo, cada um
 * com sua marca (logo quadrado, avatar redondo). O rodapé junta prazo, comentários e o avanço.
 */
export function CardInfo({
  titulo,
  legenda,
  etiqueta,
  cliente,
  responsaveis,
  dataEntrega,
  prazo,
  prioridade,
  subtarefas,
  comentarios = 0,
  progresso,
}: CardInfoProps) {
  return (
    <span className={styles.info}>
      <span className={styles.infoTopo}>
        {etiqueta}
        {prioridade && <Pill tom={prioridade.tom} cor={prioridade.cor}>{prioridade.rotulo}</Pill>}
      </span>
      <span className={styles.infoTitulo}>{titulo}</span>
      {legenda && <span className={styles.infoCargo}>{legenda}</span>}

      <BlocoDeVinculo
        empresa={cliente ? { nome: cliente.nome, logoUrl: cliente.logo_url } : null}
        pessoas={responsaveis.map((p) => ({ id: p.id, nome: p.nome, avatarUrl: p.avatar_url, detalhe: normalizarCargo(p.cargo) ?? undefined }))}
        semPessoa="Sem responsável"
      />

      <span className={styles.infoRodape}>
        <span className={styles.infoPrazo} data-prazo={prazo ?? undefined}>
          <Icone nome="calendario" tamanho={13} />
          {dataEntrega ? formatarData(dataEntrega) : 'Sem data'}
        </span>
        {subtarefas && subtarefas.total > 0 && (
          <span
            className={styles.infoContagem}
            data-completo={subtarefas.completo || undefined}
            title={subtarefas.completo ? 'Todas as subtarefas concluídas' : 'Subtarefas concluídas'}
          >
            <Icone nome="confirmar" tamanho={13} />
            {subtarefas.feitas}/{subtarefas.total}
          </span>
        )}
        {comentarios > 0 && (
          <span className={styles.infoContagem} title="Comentários">
            <Icone nome="comentario" tamanho={13} />
            {comentarios}
          </span>
        )}
      </span>

      {progresso != null && (
        <span className={styles.infoProgresso} aria-hidden="true">
          <span style={{ width: `${Math.round(progresso * 100)}%` }} />
        </span>
      )}
    </span>
  )
}
