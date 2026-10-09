import { useState } from 'react'
import { EstadoErro } from '@/components/ui/Estado'
import { Painel } from '@/components/ui/Painel'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas } from '@/dados/base'
import { useDespesas, usePagamentos } from '@/dados/tabelas'
import { formatarMes } from '@/features/clientes/cliente'
import { hojeISO } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import { ultimosMeses } from '@/lib/regras'
import { dreDoMes } from './financeiro'
import styles from './financeiro.module.css'

const sinal = (valor: number) => (valor < 0 ? 'negativo' : valor > 0 ? 'positivo' : undefined)

/** Demonstrativo do mês (receita, despesas e resultado) e a comparação dos últimos 6 meses. */
export function Dre() {
  const pagamentos = usePagamentos()
  const despesas = useDespesas()
  const estado = juntarConsultas(pagamentos, despesas)
  const hoje = hojeISO()
  const [mes, setMes] = useState(hoje.slice(0, 7))

  if (estado.erro) return <EstadoErro onTentar={estado.tentar} />

  const opcoes = ultimosMeses(hoje, 12)
    .reverse()
    .map((ponto) => ({ valor: ponto.mes, rotulo: formatarMes(ponto.mes) }))
  const linha = (qual: string) => dreDoMes(pagamentos.data ?? [], despesas.data ?? [], qual)
  const doMes = linha(mes)
  const comparacao = ultimosMeses(hoje, 6)
    .reverse()
    .map((ponto) => linha(ponto.mes))

  return (
    <>
      <Painel titulo="Resultado do mês">
        <Selecao
          className={styles.mes}
          rotulo="Mês"
          opcoes={opcoes}
          value={mes}
          onChange={(evento) => setMes(evento.target.value)}
        />
        {estado.carregando ? (
          <Skeleton altura="84px" />
        ) : (
          <dl className={styles.numeros}>
            <div>
              <dt>Receita bruta</dt>
              <dd>{formatarMoeda(doMes.receita)}</dd>
            </div>
            <div>
              <dt>Despesas</dt>
              <dd>{formatarMoeda(doMes.despesas)}</dd>
            </div>
            <div>
              <dt>Resultado líquido</dt>
              <dd data-sinal={sinal(doMes.resultado)}>{formatarMoeda(doMes.resultado)}</dd>
            </div>
          </dl>
        )}
        <p className={ui.mudo}>
          A receita soma os pagamentos confirmados no mês, pela data em que foram recebidos.
        </p>
      </Painel>

      <Painel titulo="Últimos 6 meses">
        {estado.carregando ? (
          <Skeleton altura="240px" />
        ) : (
          <div className={styles.tabelaCaixa}>
            <table className={styles.tabela}>
              <thead>
                <tr>
                  <th scope="col">Mês</th>
                  <th scope="col">Receita bruta</th>
                  <th scope="col">Despesas</th>
                  <th scope="col">Resultado líquido</th>
                </tr>
              </thead>
              <tbody>
                {comparacao.map((item) => (
                  <tr key={item.mes}>
                    <th scope="row">{formatarMes(item.mes)}</th>
                    <td>{formatarMoeda(item.receita)}</td>
                    <td>{formatarMoeda(item.despesas)}</td>
                    <td data-sinal={sinal(item.resultado)}>{formatarMoeda(item.resultado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </>
  )
}
