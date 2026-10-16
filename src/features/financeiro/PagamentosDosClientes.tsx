import { useState } from 'react'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Painel } from '@/components/ui/Painel'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { useReceitasAsaas } from '@/dados/asaas'
import { porId } from '@/dados/base'
import { useClientes } from '@/dados/tabelas'
import { useTempoReal } from '@/dados/tempoReal'
import { formatarMoeda } from '@/lib/formato'
import { plural } from '@/lib/regras'
import { progressoPorCliente, separarReceitas } from './asaas'
import type { ProgressoAsaas } from './asaas'
import { ListaDeReceitas, SemTabelaAsaas, SincronizarAsaas, nomeDaReceita } from './ReceitasAsaas'
import type { Intervalo } from '@/lib/periodos'
import styles from './financeiro.module.css'

const VISOES = [
  { valor: 'abertos', rotulo: 'Em aberto' },
  { valor: 'historico', rotulo: 'Histórico' },
  { valor: 'clientes', rotulo: 'Por cliente' },
] as const

type Visao = (typeof VISOES)[number]['valor']

/** Uma linha por cliente: quanto pagou das cobranças do mês, com a barra de progresso. */
function ProgressoDosClientes({ linhas }: { linhas: ProgressoAsaas[] }) {
  return (
    <ul className={`${ui.lista} stagger`}>
      {linhas.map((linha) => (
        <li key={linha.chave} className={styles.progressoLinha}>
          <div className={styles.progressoTopo}>
            <strong>{linha.nome}</strong>
            <span className={ui.mudo}>
              {formatarMoeda(linha.pago)} pagos de {formatarMoeda(linha.total)} ({linha.percentual}%)
            </span>
          </div>
          <span
            className={styles.progressoBarra}
            role="progressbar"
            aria-label={linha.nome}
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
 * Cobranças dos clientes, como estão no Asaas. Ninguém lança cobrança aqui: o webhook mantém
 * cada uma em dia e "Sincronizar Asaas" traz as que já existiam.
 */
export function PagamentosDosClientes({ intervalo }: { intervalo: Intervalo }) {
  const receitas = useReceitasAsaas()
  const clientes = useClientes()
  const [visao, setVisao] = useState<Visao>('abertos')
  const [clienteId, setClienteId] = useState('')
  // Um pagamento confirmado no Asaas aparece aqui sem recarregar a página
  useTempoReal(['receitas_asaas'])

  if (receitas.isError || clientes.isError) {
    return (
      <EstadoErro
        onTentar={() => {
          void receitas.refetch()
          void clientes.refetch()
        }}
      />
    )
  }
  if (receitas.isLoading || clientes.isLoading) return <Skeleton altura="240px" raio="var(--radius)" />
  if (receitas.data === null) return <SemTabelaAsaas />

  const listaDeClientes = clientes.data ?? []
  const clientePorId = porId(listaDeClientes)
  const todas = receitas.data ?? []
  const filtradas = todas.filter((r) => clienteId === '' || r.cliente_id === clienteId)
  // Em aberto: pendentes que vencem no período e vencidas até o fim dele; histórico: pagas nele
  const { abertas, historico } = separarReceitas(filtradas, intervalo)
  const lista = visao === 'abertos' ? abertas : historico
  const total = lista.reduce((soma, receita) => soma + Number(receita.valor ?? 0), 0)
  const progresso = progressoPorCliente(filtradas, intervalo, (r) => nomeDaReceita(r, clientePorId))
  const semVinculo = todas.filter((r) => !r.vinculado).length

  return (
    <Painel
      titulo="Pagamentos"
      acao={
        <div className={styles.acoesDoPainel}>
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
          <SincronizarAsaas />
        </div>
      }
    >
      {todas.length === 0 ? (
        <EstadoVazio
          ilustracao="pagamentos"
          titulo="Nenhuma cobrança do Asaas ainda."
          texto="Clique em Sincronizar Asaas para trazer as cobranças que já existem. Depois, o webhook mantém tudo em dia sozinho."
        />
      ) : (
        <>
          <div className={styles.rodape}>
            <Selecao
              className={styles.mes}
              rotulo="Cliente"
              vazio="Todos os clientes"
              opcoes={listaDeClientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              value={clienteId}
              onChange={(evento) => setClienteId(evento.target.value)}
            />
            {visao !== 'clientes' && (
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

          {semVinculo > 0 && (
            <p className={ui.mudo}>
              {plural(semVinculo, 'cobrança sem cliente vinculado', 'cobranças sem cliente vinculado')}. Use
              "Vincular cliente" na cobrança, ou cadastre o CNPJ do cliente e sincronize de novo.
            </p>
          )}

          {visao === 'clientes' ? (
            progresso.length === 0 ? (
              <EstadoVazio ilustracao="pagamentos" titulo="Nenhuma cobrança neste período." />
            ) : (
              <ProgressoDosClientes linhas={progresso} />
            )
          ) : lista.length === 0 ? (
            <EstadoVazio
              ilustracao="pagamentos"
              titulo={visao === 'abertos' ? 'Nenhuma cobrança em aberto no período.' : 'Nenhum pagamento recebido no período.'}
            />
          ) : (
            <ListaDeReceitas receitas={lista} clientes={listaDeClientes} />
          )}
        </>
      )}
    </Painel>
  )
}
