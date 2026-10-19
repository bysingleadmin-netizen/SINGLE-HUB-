import { useState } from 'react'
import detalhe from '@/components/quadro/detalhe.module.css'
import { Button } from '@/components/ui/Button'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import ui from '@/components/ui/ui.module.css'
import { formatarData } from '@/lib/formato'
import { tempoRelativo } from '@/lib/regras'
import { opcao } from '@/lib/rotulos'
import type { Aprovacao, CardAttachment, ContentCard } from '@/types/database'
import { GerarAprovacaoModal } from './GerarAprovacaoModal'
import { LinkGerado } from './LinkGerado'
import { STATUS_APROVACAO, expirou } from './aprovacao'
import styles from './aprovacao.module.css'

/** Etapa do quadro de Conteúdo em que o link pode ser gerado */
export const ETAPA_DE_APROVACAO = 'aguardando_aprovacao'

interface AprovacaoDoCardProps {
  card: Pick<ContentCard, 'id' | 'titulo' | 'client_id' | 'etapa'>
  /** Pedidos deste card, do mais novo ao mais antigo */
  aprovacoes: Aprovacao[]
  anexos: CardAttachment[]
  telefone: string | null
}

/** Seção do card de Conteúdo: gerar o link para o cliente e acompanhar as respostas. */
export function AprovacaoDoCard({ card, aprovacoes, anexos, telefone }: AprovacaoDoCardProps) {
  const [gerando, setGerando] = useState(false)
  const naEtapa = card.etapa === ETAPA_DE_APROVACAO

  return (
    <section className={detalhe.bloco} aria-label="Aprovação do cliente">
      <h3 className={detalhe.blocoTitulo}>Aprovação do cliente</h3>
      {naEtapa ? (
        <Button variante="secundario" className={styles.gerar} onClick={() => setGerando(true)}>
          <Icone nome="vinculo" tamanho={16} />
          Gerar link de aprovação
        </Button>
      ) : (
        aprovacoes.length === 0 && (
          <p className={ui.mudo}>Mova o card para Aguardando Aprovação para gerar o link do cliente.</p>
        )
      )}

      {aprovacoes.length > 0 && (
        <ul className={styles.pedidos}>
          {aprovacoes.map((a) => {
            const status = opcao(STATUS_APROVACAO, a.status)
            const vencido = a.status === 'pendente' && expirou(a)
            return (
              <li key={a.id} className={styles.pedido}>
                <div className={styles.pedidoTopo}>
                  <Pill tom={vencido ? 'cinza' : status.tom}>{vencido ? 'Link expirado' : status.rotulo}</Pill>
                  <span className={ui.mudo}>
                    {a.respondido_em
                      ? `Respondido ${tempoRelativo(a.respondido_em)}`
                      : `Gerado em ${formatarData(a.created_at.slice(0, 10))} · ${a.conteudo.length} ${
                          a.conteudo.length === 1 ? 'item' : 'itens'
                        }`}
                  </span>
                </div>
                {a.comentario && <blockquote className={styles.comentario}>{a.comentario}</blockquote>}
                {a.status === 'pendente' && !vencido && <LinkGerado aprovacao={a} telefone={telefone} />}
              </li>
            )
          })}
        </ul>
      )}

      {gerando && (
        <GerarAprovacaoModal
          card={card}
          anexos={anexos}
          telefone={telefone}
          onFechar={() => setGerando(false)}
        />
      )}
    </section>
  )
}
