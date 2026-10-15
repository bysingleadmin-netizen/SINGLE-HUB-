import { Pill } from '@/components/ui/Pill'
import ui from '@/components/ui/ui.module.css'
import { porId } from '@/dados/base'
import { formatarData, formatarMoeda } from '@/lib/formato'
import type { Client, FormaDePagamento } from '@/types/database'
import type { CartaoDePagamento } from './cartoes'
import { formatarMes } from './cliente'
import styles from './clientes.module.css'

const FORMAS: readonly { valor: FormaDePagamento; rotulo: string }[] = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
]

const rotuloDaForma = (forma: FormaDePagamento | null) =>
  FORMAS.find((item) => item.valor === forma)?.rotulo

interface HistoricoProps {
  cartoes: CartaoDePagamento[]
  clientes: Client[]
  /** Mostra de quem é cada cobrança; no detalhe de um cliente isso seria repetição */
  comCliente?: boolean
}

/** Pagamentos lançados à mão antes do Asaas, do mais recente ao mais antigo. Só consulta. */
export function HistoricoDePagamentos({ cartoes, clientes, comCliente = false }: HistoricoProps) {
  const clientePorId = porId(clientes)
  return (
    <ul className={ui.lista}>
      {cartoes.map((cartao) => (
        <li key={cartao.id} className={ui.linha}>
          <div className={ui.linhaTexto}>
            <span className={ui.linhaTitulo}>
              {comCliente && `${clientePorId.get(cartao.clienteId)?.nome ?? 'Cliente removido'}, `}
              {formatarMes(cartao.mes)}
            </span>
            <span className={ui.mudo}>
              {cartao.dataPagamento && `Pago em ${formatarData(cartao.dataPagamento)}`}
              {rotuloDaForma(cartao.forma) && `, ${rotuloDaForma(cartao.forma)}`}
            </span>
          </div>
          <span className={styles.cartaoValor}>{formatarMoeda(cartao.valor)}</span>
          <Pill tom="verde">Pago</Pill>
        </li>
      ))}
    </ul>
  )
}
