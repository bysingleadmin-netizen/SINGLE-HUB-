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
import { formatarData, formatarMoeda } from '@/lib/formato'
import { plural } from '@/lib/regras'
import {
  faturamentoPorMes,
  inadimplencia,
  pagamentosEmAtraso,
  pendenteNoMes,
  proximosVencimentos,
  receitaDoMes,
} from './financeiro'
import type { Vencimento } from './financeiro'
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

function quandoVence(dias: number): string {
  if (dias === 0) return 'Vence hoje'
  return dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`
}

function Vencimentos({ itens, atrasados = false }: { itens: Vencimento[]; atrasados?: boolean }) {
  return (
    <ul className={`${ui.lista} stagger`}>
      {itens.map((item) => (
        <li key={`${item.cliente.id}-${item.mes}`} className={`${ui.linha} ${ui.linhaClicavel}`}>
          <div className={ui.linhaTexto}>
            <Link to={`/app/clientes/${item.cliente.id}`} className={ui.linhaTitulo}>
              {item.cliente.nome}
            </Link>
            <span className={ui.mudo}>
              Referente a {formatarMes(item.mes)}, vencimento em {formatarData(item.vencimento)}
            </span>
          </div>
          <span className={styles.valor}>{formatarMoeda(item.valor)}</span>
          {atrasados ? (
            <Pill tom="vermelho">{plural(-item.dias, 'dia', 'dias')} de atraso</Pill>
          ) : (
            <Pill tom={item.dias <= 1 ? 'amarelo' : 'cinza'}>{quandoVence(item.dias)}</Pill>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Visão geral do Financeiro: quanto entra por mês, quanto já entrou, quanto falta e quem deve. */
export function Resumo() {
  const clientes = useClientes()
  const pagamentos = usePagamentos()
  const estado = juntarConsultas(clientes, pagamentos)

  if (estado.erro) return <EstadoErro onTentar={estado.tentar} />

  const hoje = hojeISO()
  const mes = hoje.slice(0, 7)
  const listaDeClientes = clientes.data ?? []
  const listaDePagamentos = pagamentos.data ?? []
  const mrr = listaDeClientes
    .filter((c) => c.status === 'ativo')
    .reduce((soma, c) => soma + Number(c.mrr), 0)
  const atrasos = pagamentosEmAtraso(listaDeClientes, listaDePagamentos, hoje)
  const proximos = proximosVencimentos(listaDeClientes, listaDePagamentos, hoje)
  const devido = inadimplencia(atrasos)

  return (
    <>
      <div className={`${styles.kpis} stagger`}>
        <KpiCard
          rotulo="MRR ativo"
          valor={mrr}
          formatar={formatarMoeda}
          carregando={estado.carregando}
        />
        <KpiCard
          rotulo="Recebido no mês"
          valor={receitaDoMes(listaDePagamentos, mes)}
          formatar={formatarMoeda}
          carregando={estado.carregando}
        />
        <KpiCard
          rotulo="Pendente no mês"
          valor={pendenteNoMes(listaDePagamentos, mes)}
          formatar={formatarMoeda}
          carregando={estado.carregando}
        />
        <div className={styles.inadimplencia} data-alerta={devido.cobrancas > 0 || undefined}>
          <KpiCard
            rotulo="Em atraso"
            valor={devido.total}
            formatar={formatarMoeda}
            carregando={estado.carregando}
          />
          {!estado.carregando && (
            <p className={styles.inadimplenciaLegenda}>
              {devido.cobrancas === 0
                ? 'Nenhuma cobrança vencida'
                : `${plural(devido.cobrancas, 'cobrança vencida', 'cobranças vencidas')} de ${plural(devido.clientes, 'cliente', 'clientes')}`}
            </p>
          )}
        </div>
      </div>

      <Painel titulo="Recebimentos dos últimos 6 meses">
        {estado.carregando ? (
          <Carregando />
        ) : (
          <GraficoMRR nome="Recebimentos" serie={faturamentoPorMes(listaDePagamentos, hoje)} />
        )}
      </Painel>

      <div className={styles.paineis}>
        <Painel titulo="Próximos vencimentos">
          {estado.carregando ? (
            <Carregando />
          ) : proximos.length === 0 ? (
            <EstadoVazio ilustracao="calendario" titulo="Nenhum vencimento nos próximos 7 dias." />
          ) : (
            <Vencimentos itens={proximos} />
          )}
        </Painel>

        <Painel titulo="Pagamentos atrasados">
          {estado.carregando ? (
            <Carregando />
          ) : atrasos.length === 0 ? (
            <EstadoVazio ilustracao="pagamentos" titulo="Nenhum pagamento atrasado." />
          ) : (
            <Vencimentos itens={atrasos} atrasados />
          )}
        </Painel>
      </div>
    </>
  )
}
