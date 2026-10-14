import type { ReactNode } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import type { OpcaoDeCampo } from '@/dados/opcoes'
import type { ResumoDeSubtarefas } from '@/dados/subtarefas'
import { formatarData } from '@/lib/formato'
import type { SituacaoDoPrazo } from '@/lib/regras'
import type { Client, Profile } from '@/types/database'
import styles from './quadro.module.css'

interface CardInfoProps {
  titulo: string
  /** Pill com o tipo da demanda ou do conteúdo */
  etiqueta: ReactNode
  cliente: Client | undefined
  responsavel: Profile | undefined
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
 * Miolo dos cards de Demandas e de Conteúdo.
 * Hierarquia: título, depois a empresa em destaque, o colaborador logo abaixo em corpo menor
 * e o cargo dele como legenda. O rodapé junta prazo, comentários e o avanço no quadro.
 */
export function CardInfo({
  titulo,
  etiqueta,
  cliente,
  responsavel,
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
        {prioridade && <Pill tom={prioridade.tom}>{prioridade.rotulo}</Pill>}
      </span>
      <span className={styles.infoTitulo}>{titulo}</span>

      <span className={styles.infoVinculo}>
        <Avatar nome={cliente?.nome ?? null} url={cliente?.logo_url} tamanho={30} />
        <span className={styles.infoVinculoTexto}>
          <span className={styles.infoEmpresa}>{cliente?.nome ?? 'Sem cliente'}</span>
          <span className={styles.infoPessoa}>{responsavel?.nome ?? 'Sem responsável'}</span>
          {responsavel && <span className={styles.infoCargo}>{responsavel.cargo}</span>}
        </span>
        {responsavel && (
          <Avatar nome={responsavel.nome} url={responsavel.avatar_url} tamanho={24} />
        )}
      </span>

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
