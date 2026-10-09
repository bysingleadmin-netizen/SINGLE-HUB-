import { useState } from 'react'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Painel } from '@/components/ui/Painel'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas } from '@/dados/base'
import { useClientes, usePagamentos } from '@/dados/tabelas'
import { CobrancasEmAberto, HistoricoDePagamentos } from '@/features/clientes/Cobrancas'
import { cartoesDe, separarCartoes } from '@/features/clientes/cartoes'
import { hojeISO } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import { plural } from '@/lib/regras'
import styles from './financeiro.module.css'

const VISOES = [
  { valor: 'abertos', rotulo: 'Em aberto' },
  { valor: 'historico', rotulo: 'Histórico' },
] as const

type Visao = (typeof VISOES)[number]['valor']

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
  const total = lista.reduce((soma, cartao) => soma + cartao.valor, 0)

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
        <div className={styles.total}>
          <span className={ui.mudo}>
            {visao === 'abertos'
              ? plural(lista.length, 'cobrança em aberto', 'cobranças em aberto')
              : plural(lista.length, 'pagamento recebido', 'pagamentos recebidos')}
          </span>
          <strong className={styles.totalValor}>{formatarMoeda(total)}</strong>
        </div>
      </div>

      {lista.length === 0 ? (
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
