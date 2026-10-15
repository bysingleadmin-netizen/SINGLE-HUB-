import { useNavigate, useParams } from 'react-router-dom'
import { Abas } from '@/components/ui/Abas'
import { Dre } from './Dre'
import { Lancamentos } from './Lancamentos'
import { MetaETrafego } from './MetaETrafego'
import { PagamentosDosClientes } from './PagamentosDosClientes'
import { Resumo } from './Resumo'
import styles from './financeiro.module.css'

const ABAS = [
  { id: 'resumo', rotulo: 'Visão Geral' },
  { id: 'pagamentos', rotulo: 'Pagamentos' },
  { id: 'despesas', rotulo: 'Despesas' },
  { id: 'relatorios', rotulo: 'Relatórios' },
] as const

type Aba = (typeof ABAS)[number]['id']

/** Financeiro da agência. A rota só chega aqui para a liderança, e o banco só entrega os dados a ela. */
export function FinanceiroPage() {
  const params = useParams<{ aba?: string }>()
  const navigate = useNavigate()
  // A aba mora no endereço, para o link de uma aba poder ser guardado; endereço desconhecido cai na primeira
  const aba: Aba = ABAS.find((item) => item.id === params.aba)?.id ?? 'resumo'

  return (
    <div className={styles.pagina}>
      <Abas
        rotulo="Seções do financeiro"
        abas={ABAS}
        ativa={aba}
        onMudar={(id) => navigate(id === 'resumo' ? '/app/financeiro' : `/app/financeiro/${id}`)}
      >
        {aba === 'resumo' && <Resumo />}
        {aba === 'pagamentos' && <PagamentosDosClientes />}
        {aba === 'despesas' && <Lancamentos />}
        {/* Relatórios: o demonstrativo do mês e, abaixo, a meta e as métricas de tráfego */}
        {aba === 'relatorios' && (
          <>
            <Dre />
            <MetaETrafego />
          </>
        )}
      </Abas>
    </div>
  )
}
