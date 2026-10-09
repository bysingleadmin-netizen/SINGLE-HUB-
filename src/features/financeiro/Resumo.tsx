import { Link } from 'react-router-dom'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { KpiCard } from '@/components/ui/KpiCard'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas } from '@/dados/base'
import { useClientes, usePagamentos } from '@/dados/tabelas'
import { formatarMes } from '@/features/clientes/cliente'
import { GraficoMRR } from '@/features/dashboard/GraficoMRR'
import { hojeISO } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import { formatarFidelidade, plural } from '@/lib/regras'
import {
  faturamentoPorMes,
  maisFieis,
  pagamentosEmAtraso,
  receitaDoMes,
} from './financeiro'
import styles from './financeiro.module.css'

function Carregando() {
  return (
    <div className={styles.carregando} aria-busy="true">
      <Skeleton altura="40px" />
      <Skeleton altura="40px" />
      <Skeleton altura="40px" />
    </div>
  )
}

/** Visão geral do Financeiro: quanto entra por mês, quanto já entrou e quem está devendo. */
export function Resumo() {
  const clientes = useClientes()
  const pagamentos = usePagamentos()
  const estado = juntarConsultas(clientes, pagamentos)

  if (estado.erro) return <EstadoErro onTentar={estado.tentar} />

  const hoje = hojeISO()
  const listaDeClientes = clientes.data ?? []
  const listaDePagamentos = pagamentos.data ?? []
  const mrr = listaDeClientes
    .filter((c) => c.status === 'ativo')
    .reduce((soma, c) => soma + Number(c.mrr), 0)
  const atrasos = pagamentosEmAtraso(listaDeClientes, listaDePagamentos, hoje)
  const fieis = maisFieis(listaDeClientes, hoje)

  return (
    <>
      <div className={`${styles.kpis} stagger`}>
        <KpiCard rotulo="MRR total" valor={mrr} formatar={formatarMoeda} carregando={estado.carregando} />
        <KpiCard rotulo="ARR" valor={mrr * 12} formatar={formatarMoeda} carregando={estado.carregando} />
        <KpiCard
          rotulo="Recebido no mês"
          valor={receitaDoMes(listaDePagamentos, hoje.slice(0, 7))}
          formatar={formatarMoeda}
          carregando={estado.carregando}
        />
        <KpiCard
          rotulo="Total em atraso"
          valor={atrasos.reduce((soma, atraso) => soma + atraso.valor, 0)}
          formatar={formatarMoeda}
          carregando={estado.carregando}
        />
      </div>

      <Painel titulo="Faturamento dos últimos 6 meses">
        {estado.carregando ? (
          <Carregando />
        ) : (
          <GraficoMRR nome="Faturamento" serie={faturamentoPorMes(listaDePagamentos, hoje)} />
        )}
      </Painel>

      <div className={styles.paineis}>
        <Painel titulo="Pagamentos atrasados">
          {estado.carregando ? (
            <Carregando />
          ) : atrasos.length === 0 ? (
            <EstadoVazio ilustracao="pagamentos" titulo="Nenhum pagamento atrasado." />
          ) : (
            <ul className={`${ui.lista} stagger`}>
              {atrasos.map((atraso) => (
                <li key={`${atraso.cliente.id}-${atraso.mes}`} className={`${ui.linha} ${ui.linhaClicavel}`}>
                  <div className={ui.linhaTexto}>
                    <Link to={`/app/clientes/${atraso.cliente.id}`} className={ui.linhaTitulo}>
                      {atraso.cliente.nome}
                    </Link>
                    <span className={ui.mudo}>Referente a {formatarMes(atraso.mes)}</span>
                  </div>
                  <span className={styles.valor}>{formatarMoeda(atraso.valor)}</span>
                  <Pill tom="vermelho">{plural(atraso.dias, 'dia', 'dias')} de atraso</Pill>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel titulo="Clientes há mais tempo">
          {estado.carregando ? (
            <Carregando />
          ) : fieis.length === 0 ? (
            <EstadoVazio
              ilustracao="clientes"
              titulo="Nenhum cliente ativo com início de contrato."
              texto="A fidelidade é contada a partir da data de início do contrato no cadastro."
            />
          ) : (
            <ol className={`${ui.lista} stagger`}>
              {fieis.map(({ cliente, meses }) => (
                <li key={cliente.id} className={`${ui.linha} ${ui.linhaClicavel}`}>
                  <div className={ui.linhaTexto}>
                    <Link to={`/app/clientes/${cliente.id}`} className={ui.linhaTitulo}>
                      {cliente.nome}
                    </Link>
                    <span className={ui.mudo}>{formatarFidelidade(meses)}</span>
                  </div>
                  <span className={styles.valor}>{formatarMoeda(Number(cliente.mrr))}</span>
                </li>
              ))}
            </ol>
          )}
        </Painel>
      </div>
    </>
  )
}
