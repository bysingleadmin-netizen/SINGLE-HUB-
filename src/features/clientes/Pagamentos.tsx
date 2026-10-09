import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { usePagamentos } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import type { Client } from '@/types/database'
import { CobrancasEmAberto, HistoricoDePagamentos } from './Cobrancas'
import { cartoesDe, diaDeVencimento, separarCartoes } from './cartoes'
import styles from './clientes.module.css'

/**
 * Pagamentos do cliente. As cobranças mensais são geradas sozinhas a partir do cadastro
 * (valor mensal e dia de vencimento); aqui só se confirma o recebimento.
 * Só é montado para a liderança.
 */
export function Pagamentos({ cliente }: { cliente: Client }) {
  const pagamentos = usePagamentos()

  if (pagamentos.isError) return <EstadoErro onTentar={() => void pagamentos.refetch()} />
  if (pagamentos.isLoading) return <Skeleton altura="120px" />

  const todos = pagamentos.data ?? []
  const { abertos, historico } = separarCartoes(
    cartoesDe(
      todos.filter((p) => p.client_id === cliente.id),
      hojeISO(),
    ),
  )

  if (abertos.length === 0 && historico.length === 0) {
    const falta =
      cliente.status !== 'ativo'
        ? 'Cliente pausado ou em churn não gera cobrança.'
        : !diaDeVencimento(cliente)
          ? 'Informe o início do contrato ou o dia do vencimento no cadastro do cliente para gerar as cobranças.'
          : Number(cliente.mrr) <= 0
            ? 'Informe o valor mensal no cadastro do cliente para gerar as cobranças.'
            : 'As cobranças deste cliente ainda estão sendo geradas.'
    return (
      <EstadoVazio
        ilustracao="pagamentos"
        titulo={falta}
        texto="As cobranças mensais são criadas sozinhas, do mês atual em diante, com o valor mensal e o dia de vencimento do cadastro."
      />
    )
  }

  return (
    <div className={styles.pagamentos}>
      <p className={ui.mudo}>
        Valor e vencimento vêm do cadastro do cliente. Se mudarem, as cobranças em aberto do mês
        atual em diante acompanham; as já pagas ficam como foram pagas.
      </p>

      <section className={styles.secao} aria-label="Em aberto">
        <h3 className={styles.secaoTitulo}>Em aberto</h3>
        {abertos.length === 0 ? (
          <p className={ui.mudo}>Nenhuma cobrança em aberto.</p>
        ) : (
          <CobrancasEmAberto cartoes={abertos} clientes={[cliente]} pagamentos={todos} />
        )}
      </section>

      <section className={styles.secao} aria-label="Histórico">
        <h3 className={styles.secaoTitulo}>Histórico</h3>
        {historico.length === 0 ? (
          <p className={ui.mudo}>Nenhum pagamento confirmado ainda.</p>
        ) : (
          <HistoricoDePagamentos cartoes={historico} clientes={[cliente]} />
        )}
      </section>
    </div>
  )
}
