import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Abas } from '@/components/ui/Abas'
import { Selecao } from '@/components/ui/Selecao'
import { hojeISO } from '@/lib/datas'
import { Dre } from './Dre'
import { Lancamentos, useEstenderRecorrencias } from './Lancamentos'
import { MetaETrafego } from './MetaETrafego'
import { PagamentosDosClientes } from './PagamentosDosClientes'
import { Resumo } from './Resumo'
import { PERIODOS, descreverIntervalo, intervaloDoPeriodo } from './periodos'
import type { PeriodoId } from './periodos'
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
  // O período vale para todas as abas e continua o mesmo ao trocar de aba
  const [periodo, setPeriodo] = useState<PeriodoId>('mes')
  const intervalo = intervaloDoPeriodo(periodo, hojeISO())
  // Despesas sem fim ganham as próximas datas sempre que o Financeiro abre
  useEstenderRecorrencias()

  return (
    <div className={styles.pagina}>
      <div className={styles.periodo}>
        <Selecao
          rotulo="Período"
          opcoes={PERIODOS}
          value={periodo}
          onChange={(evento) => setPeriodo(evento.target.value as PeriodoId)}
        />
        <span className={styles.periodoDatas}>{descreverIntervalo(intervalo)}</span>
      </div>
      <Abas
        rotulo="Seções do financeiro"
        abas={ABAS}
        ativa={aba}
        onMudar={(id) => navigate(id === 'resumo' ? '/app/financeiro' : `/app/financeiro/${id}`)}
      >
        {aba === 'resumo' && <Resumo periodo={periodo} intervalo={intervalo} />}
        {aba === 'pagamentos' && <PagamentosDosClientes intervalo={intervalo} />}
        {aba === 'despesas' && <Lancamentos intervalo={intervalo} />}
        {/* Relatórios: o demonstrativo do mês e, abaixo, a meta do período e as métricas de tráfego */}
        {aba === 'relatorios' && (
          <>
            <Dre />
            <MetaETrafego intervalo={intervalo} />
          </>
        )}
      </Abas>
    </div>
  )
}
