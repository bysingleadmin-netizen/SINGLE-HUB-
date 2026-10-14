import { useState } from 'react'
import { Campo } from '@/components/ui/Campo'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Painel } from '@/components/ui/Painel'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas } from '@/dados/base'
import { useClientes, usePagamentos } from '@/dados/tabelas'
import { CobrancasEmAberto, HistoricoDePagamentos } from '@/features/clientes/Cobrancas'
import { cartoesDe, restante, separarCartoes } from '@/features/clientes/cartoes'
import { hojeISO } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import { plural } from '@/lib/regras'
import { progressoPorCliente } from './financeiro'
import type { ProgressoDoCliente } from './financeiro'
import styles from './financeiro.module.css'

const VISOES = [
  { valor: 'abertos', rotulo: 'Em aberto' },
  { valor: 'historico', rotulo: 'Histórico' },
  { valor: 'clientes', rotulo: 'Por cliente' },
] as const

type Visao = (typeof VISOES)[number]['valor']

/** Uma linha por cliente: quanto pagou das cobranças do mês, com a barra de progresso. */
function ProgressoDosClientes({ linhas }: { linhas: ProgressoDoCliente[] }) {
  return (
    <ul className={`${ui.lista} stagger`}>
      {linhas.map((linha) => (
        <li key={linha.cliente.id} className={styles.progressoLinha}>
          <div className={styles.progressoTopo}>
            <strong>{linha.cliente.nome}</strong>
            <span className={ui.mudo}>
              {formatarMoeda(linha.pago)} pagos de {formatarMoeda(linha.total)} ({linha.percentual}%)
            </span>
          </div>
          <span
            className={styles.progressoBarra}
            role="progressbar"
            aria-label={linha.cliente.nome}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={linha.percentual}
            data-completo={linha.percentual >= 100 || undefined}
          >
            <span style={{ width: `${Math.min(linha.percentual, 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Cobranças mensais de todos os clientes. Elas nascem sozinhas do cadastro de cada cliente;
 * aqui a liderança confirma o que recebeu (Pix ou dinheiro) e consulta o histórico.
 */
export function PagamentosDosClientes() {
  const clientes = useClientes()
  const pagamentos = usePagamentos()
  const estado = juntarConsultas(clientes, pagamentos)
  const [visao, setVisao] = useState<Visao>('abertos')
  const [clienteId, setClienteId] = useState('')
  const [mes, setMes] = useState(() => hojeISO().slice(0, 7))

  if (estado.erro) return <EstadoErro onTentar={estado.tentar} />
  if (estado.carregando) return <Skeleton altura="240px" raio="var(--radius)" />

  const listaDeClientes = clientes.data ?? []
  const todos = pagamentos.data ?? []
  const { abertos, historico } = separarCartoes(
    cartoesDe(
      todos.filter((p) => clienteId === '' || p.client_id === clienteId),
      hojeISO(),
    ),
  )
  const lista = visao === 'abertos' ? abertos : historico
  // Em aberto conta só o que falta receber; o histórico, o que foi pago
  const total = lista.reduce(
    (soma, cartao) => soma + (visao === 'abertos' ? restante(cartao.valor, cartao.valorPago) : cartao.valor),
    0,
  )
  const progresso = progressoPorCliente(
    listaDeClientes.filter((c) => clienteId === '' || c.id === clienteId),
    todos,
    mes,
  )

  return (
    <Painel
      titulo="Pagamentos"
      acao={
        <div className={styles.alternar} role="group" aria-label="Quais pagamentos mostrar">
          {VISOES.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              className={styles.alternarBotao}
              aria-pressed={visao === opcao.valor}
              onClick={() => setVisao(opcao.valor)}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      }
    >
      <div className={styles.rodape}>
        <Selecao
          className={styles.mes}
          rotulo="Cliente"
          vazio="Todos os clientes"
          opcoes={listaDeClientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
          value={clienteId}
          onChange={(evento) => setClienteId(evento.target.value)}
        />
        {visao === 'clientes' ? (
          <Campo
            className={styles.mes}
            rotulo="Mês"
            type="month"
            value={mes}
            onChange={(evento) => setMes(evento.target.value || hojeISO().slice(0, 7))}
          />
        ) : (
          <div className={styles.total}>
            <span className={ui.mudo}>
              {visao === 'abertos'
                ? plural(lista.length, 'cobrança em aberto', 'cobranças em aberto')
                : plural(lista.length, 'pagamento recebido', 'pagamentos recebidos')}
            </span>
            <strong className={styles.totalValor}>{formatarMoeda(total)}</strong>
          </div>
        )}
      </div>

      {visao === 'clientes' ? (
        progresso.length === 0 ? (
          <EstadoVazio ilustracao="pagamentos" titulo="Nenhuma cobrança neste mês." />
        ) : (
          <ProgressoDosClientes linhas={progresso} />
        )
      ) : lista.length === 0 ? (
        <EstadoVazio
          ilustracao="pagamentos"
          titulo={
            visao === 'abertos' ? 'Nenhuma cobrança em aberto.' : 'Nenhum pagamento confirmado ainda.'
          }
          texto={
            visao === 'abertos'
              ? 'As cobranças são criadas sozinhas para os clientes ativos com valor mensal e dia de vencimento no cadastro.'
              : 'Ao confirmar um pagamento, ele sai das cobranças em aberto e fica guardado aqui.'
          }
        />
      ) : visao === 'abertos' ? (
        <CobrancasEmAberto cartoes={abertos} clientes={listaDeClientes} pagamentos={todos} comCliente />
      ) : (
        <HistoricoDePagamentos cartoes={historico} clientes={listaDeClientes} comCliente />
      )}
    </Painel>
  )
}
