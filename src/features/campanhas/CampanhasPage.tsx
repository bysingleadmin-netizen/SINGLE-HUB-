import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import ui from '@/components/ui/ui.module.css'
import { juntarConsultas, porId } from '@/dados/base'
import { useCampanhas, useClientes } from '@/dados/tabelas'
import { hojeISO } from '@/lib/datas'
import { formatarMoeda } from '@/lib/formato'
import { otimizacaoPendente } from '@/lib/regras'
import { STATUS_CAMPANHA, opcao } from '@/lib/rotulos'
import { CampanhaModal } from './CampanhaModal'
import { periodoDaCampanha } from './campanha'
import styles from './campanhas.module.css'

export function CampanhasPage() {
  const campanhas = useCampanhas()
  const clientes = useClientes()
  const [criando, setCriando] = useState(false)

  const consultas = juntarConsultas(campanhas, clientes)
  const lista = campanhas.data ?? []
  const clientePorId = porId(clientes.data)
  const hoje = hojeISO()

  const botaoNova = (
    <Button onClick={() => setCriando(true)}>
      <Icone nome="mais" tamanho={16} />
      Nova campanha
    </Button>
  )

  return (
    <div className={styles.pagina}>
      <div className={styles.barra}>{botaoNova}</div>

      {consultas.erro ? (
        <EstadoErro onTentar={consultas.tentar} />
      ) : consultas.carregando ? (
        <div className={styles.lista} aria-busy="true">
          <Skeleton altura="76px" raio="var(--radius)" />
          <Skeleton altura="76px" raio="var(--radius)" />
        </div>
      ) : lista.length === 0 ? (
        <EstadoVazio
          ilustracao="campanhas" titulo="Nenhuma campanha ainda."
          texto="Crie a primeira para acompanhar estratégia, tarefas e otimizações."
          acao={botaoNova}
        />
      ) : (
        <ul className={`${styles.lista} stagger`}>
          {lista.map((campanha) => {
            const status = opcao(STATUS_CAMPANHA, campanha.status)
            return (
              <li key={campanha.id} className={styles.item}>
                <div className={ui.linhaTexto}>
                  <Link to={`/app/campanhas/${campanha.id}`} className={styles.itemNome}>
                    {campanha.nome}
                  </Link>
                  <span className={ui.mudo}>
                    {clientePorId.get(campanha.client_id)?.nome ?? 'Sem cliente'},{' '}
                    {periodoDaCampanha(campanha)}
                  </span>
                </div>
                <div className={styles.itemLado}>
                  {otimizacaoPendente(campanha, hoje) && (
                    <Pill tom="vermelho">Otimização pendente</Pill>
                  )}
                  <Pill tom={status.tom}>{status.rotulo}</Pill>
                  <span className={styles.itemValor}>{formatarMoeda(Number(campanha.orcamento))}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {criando && (
        <CampanhaModal clientes={clientes.data ?? []} onFechar={() => setCriando(false)} />
      )}
    </div>
  )
}
