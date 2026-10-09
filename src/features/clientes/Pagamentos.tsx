import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useColunasOpcionais } from '@/dados/esquema'
import { useConfirmarPagamento } from '@/dados/pagamentos'
import { usePagamentos } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { STATUS_PAGAMENTO, opcao } from '@/lib/rotulos'
import type { Client, FormaDePagamento } from '@/types/database'
import { gerarCartoes } from './cartoes'
import type { CartaoDePagamento } from './cartoes'
import { formatarMes } from './cliente'
import styles from './clientes.module.css'

const FORMAS: readonly { valor: FormaDePagamento; rotulo: string; icone: 'pix' | 'dinheiro' }[] = [
  { valor: 'pix', rotulo: 'Pix', icone: 'pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro', icone: 'dinheiro' },
]

const rotuloDaForma = (forma: FormaDePagamento | null) =>
  FORMAS.find((item) => item.valor === forma)?.rotulo

/**
 * Pagamentos do cliente. Os cartões mensais saem do cadastro (início do contrato, valor
 * mensal e dia de vencimento); aqui só se confirma o recebimento. Só é montado para a liderança.
 */
export function Pagamentos({ cliente }: { cliente: Client }) {
  const pagamentos = usePagamentos()
  const colunas = useColunasOpcionais()
  const confirmar = useConfirmarPagamento()
  const toast = useToast()
  const [escolha, setEscolha] = useState<{ cartao: CartaoDePagamento; forma: FormaDePagamento }>()

  if (pagamentos.isError) return <EstadoErro onTentar={() => void pagamentos.refetch()} />
  if (pagamentos.isLoading || !colunas.pronto) return <Skeleton altura="120px" />

  const cartoes = gerarCartoes(cliente, pagamentos.data ?? [], hojeISO())
  const abertos = cartoes.filter((cartao) => cartao.status !== 'pago')
  const pagos = cartoes.filter((cartao) => cartao.status === 'pago').reverse()

  function confirmarPagamento() {
    if (!escolha) return
    confirmar.mutate(
      {
        cliente,
        cartao: escolha.cartao,
        forma: escolha.forma,
        gravarForma: colunas.formaPagamento,
        pagamentos: pagamentos.data ?? [],
      },
      {
        onSuccess: () => {
          toast.sucesso(
            colunas.formaPagamento
              ? 'Pagamento confirmado.'
              : 'Pagamento confirmado. A forma de pagamento não foi gravada: falta rodar a migration 0002.',
          )
          setEscolha(undefined)
        },
        onError: () => {
          toast.erro('Não foi possível confirmar o pagamento.')
          setEscolha(undefined)
        },
      },
    )
  }

  if (cartoes.length === 0) {
    return (
      <EstadoVazio
        ilustracao="pagamentos"
        titulo={
          cliente.data_inicio_contrato
            ? 'Nenhum pagamento para mostrar.'
            : 'Informe o início do contrato no cadastro do cliente para gerar os pagamentos.'
        }
        texto="Os cartões mensais são criados sozinhos a partir do início do contrato, do valor mensal e do dia de vencimento."
      />
    )
  }

  return (
    <div className={styles.pagamentos}>
      <p className={ui.mudo}>
        Valor e vencimento vêm do cadastro do cliente. Se mudarem, os meses em aberto acompanham e
        os já pagos ficam como foram pagos.
      </p>

      <section className={styles.secao} aria-label="Em aberto">
        <h3 className={styles.secaoTitulo}>Em aberto</h3>
        {abertos.length === 0 ? (
          <p className={ui.mudo}>Nenhum mês em aberto.</p>
        ) : (
          <ul className={`${styles.cartoes} stagger`}>
            {abertos.map((cartao) => {
              const status = opcao(STATUS_PAGAMENTO, cartao.status)
              const mes = formatarMes(cartao.mes)
              return (
                <li key={cartao.mes} className={styles.cartao} data-status={cartao.status}>
                  <div className={styles.cartaoTopo}>
                    <span className={styles.cartaoMes}>{mes}</span>
                    <Pill tom={status.tom}>{status.rotulo}</Pill>
                  </div>
                  <span className={styles.cartaoValor}>{formatarMoeda(cartao.valor)}</span>
                  <span className={ui.mudo}>Vence em {formatarData(cartao.vencimento)}</span>
                  <div className={styles.cartaoAcoes}>
                    {FORMAS.map((forma) => (
                      <button
                        key={forma.valor}
                        type="button"
                        className={styles.cartaoAcao}
                        aria-label={`Pagar ${mes} com ${forma.rotulo}`}
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
        )}
      </section>

      <section className={styles.secao} aria-label="Histórico">
        <h3 className={styles.secaoTitulo}>Histórico</h3>
        {pagos.length === 0 ? (
          <p className={ui.mudo}>Nenhum pagamento confirmado ainda.</p>
        ) : (
          <ul className={ui.lista}>
            {pagos.map((cartao) => (
              <li key={cartao.mes} className={ui.linha}>
                <div className={ui.linhaTexto}>
                  <span className={ui.linhaTitulo}>{formatarMes(cartao.mes)}</span>
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
        )}
      </section>

      {escolha && (
        <Modal aberto titulo="Confirmar pagamento" onFechar={() => setEscolha(undefined)}>
          <div className={ui.formulario}>
            <p>
              Confirmar o recebimento de <strong>{formatarMoeda(escolha.cartao.valor)}</strong>,
              referente a <strong>{formatarMes(escolha.cartao.mes)}</strong>, por{' '}
              <strong>{rotuloDaForma(escolha.forma)}</strong>?
            </p>
            <p className={ui.mudo}>
              O mês vai para o histórico como pago e o cartão do mês seguinte é criado.
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
    </div>
  )
}
