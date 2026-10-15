import { useState } from 'react'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import { rotuloDoAnexo } from '@/dados/anexos'
import type { CardAttachment, QuadroId } from '@/types/database'
import { Anexos } from './Anexos'
import styles from './anexos.module.css'

/** Quantas miniaturas cabem no card antes do "+N" */
const MINIATURAS = 4

interface RodapeDoCardProps {
  quadro: QuadroId
  cardId: string
  titulo: string
  /** undefined quando o banco ainda não tem a tabela de anexos */
  anexos: CardAttachment[] | undefined
}

/**
 * Faixa de baixo do card, fora do botão que abre o detalhe: as miniaturas dos anexos, cada uma
 * abrindo o arquivo ou o link.
 */
export function RodapeDoCard({
  quadro,
  cardId,
  titulo,
  anexos,
}: RodapeDoCardProps) {
  const [anexando, setAnexando] = useState(false)
  const visiveis = (anexos ?? []).slice(0, MINIATURAS)
  const resto = (anexos?.length ?? 0) - visiveis.length

  if (!anexos) return null

  return (
    <div className={styles.rodape}>
      <div className={styles.miniaturas}>
        {visiveis.map((anexo) => (
          <a
            key={anexo.id}
            className={styles.miniatura}
            href={anexo.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Abrir anexo ${rotuloDoAnexo(anexo)}`}
            title={rotuloDoAnexo(anexo)}
          >
            {anexo.tipo === 'imagem' ? (
              <img src={anexo.url} alt="" />
            ) : (
              <Icone nome="externo" tamanho={13} />
            )}
          </a>
        ))}
        {resto > 0 && <span className={styles.resto}>+{resto}</span>}
        <button
          type="button"
          className={styles.miniatura}
          data-acao
          aria-label={`Anexar em ${titulo}`}
          title="Anexar link ou imagem"
          onClick={() => setAnexando(true)}
        >
          <Icone nome="anexo" tamanho={14} />
        </button>
      </div>

      {anexando && (
        <Modal aberto titulo={`Anexos de ${titulo}`} onFechar={() => setAnexando(false)}>
          <Anexos quadro={quadro} cardId={cardId} anexos={anexos} />
        </Modal>
      )}
    </div>
  )
}
