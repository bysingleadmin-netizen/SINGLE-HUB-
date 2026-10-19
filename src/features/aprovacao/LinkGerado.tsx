import { useToast } from '@/components/ui/Toast'
import { Icone } from '@/components/ui/Icone'
import { linkDoWhatsapp } from '@/features/crm/crm'
import type { Aprovacao } from '@/types/database'
import { linkDaAprovacao, mensagemDoWhatsapp } from './aprovacao'
import styles from './aprovacao.module.css'

interface LinkGeradoProps {
  aprovacao: Pick<Aprovacao, 'token' | 'titulo'>
  /** Telefone do contato do cliente; sem ele o WhatsApp abre para escolher a conversa */
  telefone: string | null
}

/** O link do pedido, com os botões de copiar e de mandar pelo WhatsApp. */
export function LinkGerado({ aprovacao, telefone }: LinkGeradoProps) {
  const toast = useToast()
  const link = linkDaAprovacao(aprovacao.token)
  const texto = encodeURIComponent(mensagemDoWhatsapp(aprovacao.titulo, link))
  const whatsapp = `${linkDoWhatsapp(telefone) ?? 'https://wa.me/'}?text=${texto}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      toast.sucesso('Link copiado.')
    } catch {
      toast.erro('Não foi possível copiar. Selecione o link e copie à mão.')
    }
  }

  return (
    <div className={styles.link}>
      <input
        className={styles.linkTexto}
        readOnly
        aria-label="Link de aprovação"
        value={link}
        onFocus={(evento) => evento.target.select()}
      />
      <div className={styles.linkAcoes}>
        <button type="button" className={styles.linkBotao} onClick={() => void copiar()}>
          <Icone nome="vinculo" tamanho={15} />
          Copiar link
        </button>
        <a className={styles.linkWhatsapp} href={whatsapp} target="_blank" rel="noopener noreferrer">
          <Icone nome="whatsapp" tamanho={15} />
          Enviar no WhatsApp
        </a>
      </div>
    </div>
  )
}
