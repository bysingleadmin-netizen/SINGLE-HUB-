import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import { Pill } from '@/components/ui/Pill'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { porId } from '@/dados/base'
import { useConfirmarPagamento, useMensagemDePagamento } from '@/dados/pagamentos'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { STATUS_PAGAMENTO, opcao } from '@/lib/rotulos'
import type { Client, ClientPayment, FormaDePagamento } from '@/types/database'
import type { CartaoDePagamento } from './cartoes'
import { formatarMes } from './cliente'
import styles from './clientes.module.css'

const FORMAS: readonly { valor: FormaDePagamento; rotulo: string; icone: 'pix' | 'dinheiro' }[] = [
  { valor: 'pix', rotulo: 'Pix', icone: 'pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro', icone: 'dinheiro' },
]

const rotuloDaForma = (forma: FormaDePagamento | null) =>
  FORMAS.find((item) => item.valor === forma)?.rotulo

interface CobrancasProps {
  cartoes: CartaoDePagamento[]
  clientes: Client[]
  /** Todos os pagamentos carregados, para a confirmação saber o que já existe */
  pagamentos: ClientPayment[]
  /** Mostra de quem é cada cobrança; no detalhe de um cliente isso seria repetição */
  comCliente?: boolean
}

/** Cobranças em aberto como cartões, cada um com os botões de Pix e de dinheiro. */
export function CobrancasEmAberto({ cartoes, clientes, pagamentos, comCliente = false }: CobrancasProps) {
  const confirmar = useConfirmarPagamento()
  const mensagem = useMensagemDePagamento()
  const toast = useToast()
  const [escolha, setEscolha] = useState<{ cartao: CartaoDePagamento; forma: FormaDePagamento }>()
  const clientePorId = porId(clientes)
  const nomeDe = (cartao: CartaoDePagamento) =>
    clientePorId.get(cartao.clienteId)?.nome ?? 'Cliente removido'

  function confirmarPagamento() {
    if (!escolha) return
    confirmar.mutate(
      {
        cliente: clientePorId.get(escolha.cartao.clienteId),
        cartao: escolha.cartao,
        forma: escolha.forma,
        pagamentos,
      },
      {
        onSuccess: () => toast.sucesso(mensagem),
        onError: () => toast.erro('Não foi possível confirmar o pagamento.'),
        onSettled: () => setEscolha(undefined),
      },
    )
  }

  return (
    <>
      <ul className={`${styles.cartoes} stagger`}>
        {cartoes.map((cartao) => {
          const status = opcao(STATUS_PAGAMENTO, cartao.status)
          const mes = formatarMes(cartao.mes)
          const alvo = comCliente ? `${mes} de ${nomeDe(cartao)}` : mes
          return (
            <li key={cartao.id} className={styles.cartao} data-status={cartao.status}>
              <div className={styles.cartaoTopo}>
                <span className={styles.cartaoMes}>{mes}</span>
                <Pill tom={status.tom}>{status.rotulo}</Pill>
              </div>
              {comCliente && <span className={styles.cartaoCliente}>{nomeDe(cartao)}</span>}
              <span className={styles.cartaoValor}>{formatarMoeda(cartao.valor)}</span>
              <span className={ui.mudo}>Vence em {formatarData(cartao.vencimento)}</span>
              <div className={styles.cartaoAcoes}>
                {FORMAS.map((forma) => (
                  <button
                    key={forma.valor}
                    type="button"
                    className={styles.cartaoAcao}
                    aria-label={`Pagar ${alvo} com ${forma.rotulo}`}
                    title={`Recebido por ${forma.rotulo}`}
                    onClick={() => setEscolha({ cartao, forma: forma.valor })}
                  >
                    <Icone nome={forma.icone} tamanho={18} />
                    {forma.rotulo}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>

      {escolha && (
        <Modal aberto titulo="Confirmar pagamento" onFechar={() => setEscolha(undefined)}>
          <div className={ui.formulario}>
            <p>
              Confirmar o recebimento de <strong>{formatarMoeda(escolha.cartao.valor)}</strong>
              {comCliente && (
                <>
                  {' '}
                  de <strong>{nomeDe(escolha.cartao)}</strong>
                </>
              )}
              , referente a <strong>{formatarMes(escolha.cartao.mes)}</strong>, por{' '}
              <strong>{rotuloDaForma(escolha.forma)}</strong>?
            </p>
            <p className={ui.mudo}>
              A cobrança vai para o histórico como paga, com a data de hoje, e a do mês seguinte é
              criada se ainda não existir.
            </p>
            <div className={ui.acoes}>
              <Button variante="fantasma" onClick={() => setEscolha(undefined)}>
                Cancelar
              </Button>
              <Button carregando={confirmar.isPending} onClick={confirmarPagamento}>
                Confirmar pagamento
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

/** Pagamentos já confirmados, do mais recente ao mais antigo. */
export function HistoricoDePagamentos({
  cartoes,
  clientes,
  comCliente = false,
}: Omit<CobrancasProps, 'pagamentos'>) {
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
