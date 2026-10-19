import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { BlocoDeVinculo } from '@/components/ui/BlocoDeVinculo'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import ui from '@/components/ui/ui.module.css'
import { useColunasOpcionais } from '@/dados/esquema'
import { usePerfis } from '@/dados/tabelas'
import { linkDoWhatsapp } from '@/features/crm/crm'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { normalizarCargo } from '@/lib/permissoes'
import { STATUS_CLIENTE, opcao } from '@/lib/rotulos'
import type { Client } from '@/types/database'
import { Dados } from './ClientePage'
import { contatosDe, fidelidadeDoCliente } from './cliente'
import { fimDoContrato, seloDoContrato } from './contrato'
import styles from './clientes.module.css'

interface ClienteDrawerProps {
  cliente: Client
  onEditar: () => void
  onFechar: () => void
}

/** Ficha do cliente aberta a partir da tabela da Base de Clientes. */
export function ClienteDrawer({ cliente, onEditar, onFechar }: ClienteDrawerProps) {
  const colunas = useColunasOpcionais()
  const perfis = usePerfis()
  const status = opcao(STATUS_CLIENTE, cliente.status)
  const selo = seloDoContrato(cliente, hojeISO())
  const fim =
    cliente.data_inicio_contrato && cliente.contrato_meses
      ? fimDoContrato(cliente.data_inicio_contrato, cliente.contrato_meses)
      : null
  const responsaveis = (cliente.responsaveis ?? [])
    .map((id) => perfis.data?.find((p) => p.id === id))
    .filter((p) => p != null)
  const contatos = contatosDe(cliente)

  return (
    <Drawer
      aberto
      titulo={cliente.nome}
      onFechar={onFechar}
      rodape={
        <>
          <Link to={`/app/clientes/${cliente.id}`} className={`${ui.linkAcao} ${styles.fichaLink}`}>
            Abrir página do cliente
          </Link>
          <Button onClick={onEditar}>
            <Icone nome="editar" tamanho={16} />
            Editar
          </Button>
        </>
      }
    >
      <div className={styles.ficha}>
        <div className={styles.fichaTopo}>
          <Avatar nome={cliente.nome} url={cliente.logo_url} tamanho={48} forma="quadrado" />
          <div className={styles.fichaTitulo}>
            <Pill tom={status.tom}>{status.rotulo}</Pill>
            {cliente.area_atuacao && <span className={ui.mudo}>{cliente.area_atuacao}</span>}
          </div>
        </div>

        <Dados
          itens={[
            ['CNPJ ou CPF', cliente.cnpj ?? 'Não informado'],
            ...(colunas.baseDeClientes
              ? [['Área de atuação', cliente.area_atuacao ?? 'Não informada'] as [string, string]]
              : []),
            ['Valor mensal (MRR)', formatarMoeda(Number(cliente.mrr))],
            ['Tempo de casa', fidelidadeDoCliente(cliente)],
            ['Início', cliente.data_inicio_contrato ? formatarData(cliente.data_inicio_contrato) : 'Não informado'],
            ['Encerramento', fim ? formatarData(fim) : 'Sem fidelidade'],
          ]}
        />
        {selo && (
          <span className={styles.fichaSelo}>
            <Pill tom={selo.tom}>{selo.texto}</Pill>
          </span>
        )}

        {colunas.baseDeClientes && (
          <section className={styles.secao} aria-label="Responsáveis da SINGLE">
            <h3 className={styles.secaoTitulo}>Responsáveis da SINGLE</h3>
            {responsaveis.length > 0 ? (
              <ul className={styles.fichaLista}>
                {responsaveis.map((perfil) => (
                  <li key={perfil.id}>
                    <BlocoDeVinculo
                      pessoas={[
                        { id: perfil.id, nome: perfil.nome, avatarUrl: perfil.avatar_url, detalhe: normalizarCargo(perfil.cargo) },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className={ui.mudo}>Ninguém da equipe definido.</p>
            )}
          </section>
        )}

        <section className={styles.secao} aria-label="Contatos">
          <h3 className={styles.secaoTitulo}>Contatos</h3>
          {contatos.length > 0 ? (
            <ul className={styles.fichaLista}>
              {contatos.map((contato, i) => {
                const whatsapp = linkDoWhatsapp(contato.telefone ?? null)
                return (
                  <li key={i} className={styles.fichaContato}>
                    <BlocoDeVinculo
                      pessoas={[{ nome: contato.nome || 'Sem nome', detalhe: contato.funcao ?? 'Contato' }]}
                    />
                    {contato.email && (
                      <a href={`mailto:${contato.email}`} className={ui.linkAcao}>
                        <Icone nome="email" tamanho={15} />
                        {contato.email}
                      </a>
                    )}
                    {contato.telefone && (
                      <span className={styles.telefone}>
                        <Icone nome="telefone" tamanho={15} />
                        <span>{contato.telefone}</span>
                        {whatsapp && (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.whatsapp}
                            aria-label={`Abrir WhatsApp de ${contato.nome || cliente.nome}`}
                          >
                            <Icone nome="whatsapp" tamanho={16} />
                            WhatsApp
                          </a>
                        )}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className={ui.mudo}>Nenhum contato cadastrado.</p>
          )}
        </section>
      </div>
    </Drawer>
  )
}
