import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { useReceitasAsaas } from '@/dados/asaas'
import { useClientes, usePagamentos } from '@/dados/tabelas'
import { useTempoReal } from '@/dados/tempoReal'
import { separarReceitas } from '@/features/financeiro/asaas'
import { ListaDeReceitas, SemTabelaAsaas } from '@/features/financeiro/ReceitasAsaas'
import { hojeISO } from '@/lib/datas'
import type { Client } from '@/types/database'
import { HistoricoDePagamentos } from './Cobrancas'
import { cartoesDe, separarCartoes } from './cartoes'
import styles from './clientes.module.css'

/**
 * Pagamentos do cliente, como estão no Asaas: as cobranças vinculadas a ele. Os pagamentos
 * lançados à mão antes do Asaas ficam abaixo, só para consulta.
 * Só é montado para a liderança.
 */
export function Pagamentos({ cliente }: { cliente: Client }) {
  const receitas = useReceitasAsaas()
  const clientes = useClientes()
  const pagamentos = usePagamentos()
  useTempoReal(['receitas_asaas'])

  if (receitas.isError || clientes.isError || pagamentos.isError) {
    return (
      <EstadoErro
        onTentar={() => {
          void receitas.refetch()
          void clientes.refetch()
          void pagamentos.refetch()
        }}
      />
    )
  }
  if (receitas.isLoading || clientes.isLoading || pagamentos.isLoading) return <Skeleton altura="120px" />

  const doCliente = (receitas.data ?? []).filter((r) => r.cliente_id === cliente.id)
  const { abertas, historico } = separarReceitas(doCliente)
  const antigos = separarCartoes(
    cartoesDe(
      (pagamentos.data ?? []).filter((p) => p.client_id === cliente.id),
      hojeISO(),
    ),
  ).historico

  return (
    <div className={styles.pagamentos}>
      {receitas.data === null ? (
        <SemTabelaAsaas />
      ) : doCliente.length === 0 ? (
        <EstadoVazio
          ilustracao="pagamentos"
          titulo="Nenhuma cobrança do Asaas ligada a este cliente."
          texto="As cobranças vêm do Asaas. Cadastre o CNPJ do cliente e use Sincronizar Asaas em Financeiro > Pagamentos, ou vincule a cobrança por lá."
        />
      ) : (
        <>
          <section className={styles.secao} aria-label="Em aberto">
            <h3 className={styles.secaoTitulo}>Em aberto</h3>
            {abertas.length === 0 ? (
              <p className={ui.mudo}>Nenhuma cobrança em aberto.</p>
            ) : (
              <ListaDeReceitas receitas={abertas} clientes={clientes.data ?? []} comCliente={false} />
            )}
          </section>

          <section className={styles.secao} aria-label="Histórico">
            <h3 className={styles.secaoTitulo}>Histórico</h3>
            {historico.length === 0 ? (
              <p className={ui.mudo}>Nenhum pagamento recebido ainda.</p>
            ) : (
              <ListaDeReceitas receitas={historico} clientes={clientes.data ?? []} comCliente={false} />
            )}
          </section>
        </>
      )}

      {antigos.length > 0 && (
        <section className={styles.secao} aria-label="Lançados à mão">
          <h3 className={styles.secaoTitulo}>Lançados à mão, antes do Asaas</h3>
          <p className={ui.mudo}>Ficam aqui só para consulta e não entram nos totais do Financeiro.</p>
          <HistoricoDePagamentos cartoes={antigos} clientes={[cliente]} />
        </section>
      )}
    </div>
  )
}
