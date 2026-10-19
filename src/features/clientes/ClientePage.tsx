import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Abas } from '@/components/ui/Abas'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Avatar } from '@/components/ui/Avatar'
import { BlocoDeVinculo } from '@/components/ui/BlocoDeVinculo'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import type { NomeIcone } from '@/components/ui/Icone'
import type { NomeIlustracao } from '@/components/ui/Ilustracao'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusSelect } from '@/components/ui/StatusSelect'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { ACEITA_IMAGENS, enviarImagem, validarImagem } from '@/dados/arquivos'
import { juntarConsultas, useAtualizarOtimista } from '@/dados/base'
import { useColunasOpcionais } from '@/dados/esquema'
import { useCampanhas, useCards, useClientes, usePerfis, useTarefas } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { hojeISO } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { textoOuNull } from '@/lib/formulario'
import { isLideranca } from '@/lib/permissoes'
import {
  COLUNAS_CONTEUDO,
  COLUNAS_TAREFA,
  STATUS_CAMPANHA,
  STATUS_CLIENTE,
  opcao,
} from '@/lib/rotulos'
import type { Client, ClientStatus } from '@/types/database'
import { linkDoWhatsapp } from '@/features/crm/crm'
import { rotaDaTarefa } from '@/features/demandas/tarefa'
import { ClienteModal } from './ClienteModal'
import { Pagamentos } from './Pagamentos'
import { contatosDe, fidelidadeDoCliente, linkInstagram, plataformaDoLink } from './cliente'
import { fimDoContrato, seloDoContrato } from './contrato'
import styles from './clientes.module.css'

type Aba = 'visao' | 'pagamentos' | 'demandas' | 'campanhas' | 'conteudos'

const ABAS: readonly { id: Aba; rotulo: string }[] = [
  { id: 'visao', rotulo: 'Visão Geral' },
  { id: 'pagamentos', rotulo: 'Pagamentos' },
  { id: 'demandas', rotulo: 'Demandas' },
  { id: 'campanhas', rotulo: 'Anúncios' },
  { id: 'conteudos', rotulo: 'Conteúdos' },
]

function tituloDe(colunas: readonly { id: string; titulo: string }[], id: string): string {
  return colunas.find((coluna) => coluna.id === id)?.titulo ?? 'Arquivado'
}

/** Uma linha de canal: o ícone diz qual é, e o conteúdo vem ao lado */
function Canal({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <li className={styles.canal}>
      <span className={styles.canalIcone} title={rotulo}>
        <Icone nome={icone} tamanho={18} />
        <span className={ui.somenteLeitor}>{rotulo}</span>
      </span>
      <span className={styles.canalConteudo}>{children}</span>
    </li>
  )
}

/** Dados com rótulo, numa grade de duas colunas */
export function Dados({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className={styles.dados}>
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo}>
          <dt>{rotulo}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function VisaoGeral({ cliente, lideranca }: { cliente: Client; lideranca: boolean }) {
  const atualizar = useAtualizarOtimista<Client>('clients')
  const toast = useToast()
  const colunas = useColunasOpcionais()
  const perfis = usePerfis()
  const contatos = contatosDe(cliente)
  const responsaveis = (cliente.responsaveis ?? [])
    .map((id) => perfis.data?.find((p) => p.id === id)?.nome)
    .filter((nome) => nome != null)
  const [observacoes, setObservacoes] = useState(cliente.observacoes ?? '')
  const instagram = linkInstagram(cliente.instagram)
  const whatsapp = linkDoWhatsapp(cliente.contato_telefone)
  const selo = seloDoContrato(cliente, hojeISO())
  const fim =
    cliente.data_inicio_contrato && cliente.contrato_meses
      ? fimDoContrato(cliente.data_inicio_contrato, cliente.contrato_meses)
      : null

  function trocarStatus(status: ClientStatus) {
    atualizar.mutate(
      { id: cliente.id, valores: { status } },
      {
        onSuccess: () => toast.sucesso('Status atualizado.'),
        onError: () => toast.erro('Não foi possível atualizar o status.'),
      },
    )
  }

  function salvarObservacoes() {
    const novas = textoOuNull(observacoes)
    if (novas === (cliente.observacoes ?? null)) return
    atualizar.mutate(
      { id: cliente.id, valores: { observacoes: novas } },
      {
        onSuccess: () => toast.sucesso('Observações salvas.'),
        onError: () => toast.erro('Não foi possível salvar as observações.'),
      },
    )
  }

  return (
    <div className={styles.perfil}>
      <Painel titulo="Informações básicas">
        <div className={styles.secao}>
          <StatusSelect
            className={styles.status}
            rotulo="Status"
            opcoes={STATUS_CLIENTE}
            value={cliente.status}
            onChange={(valor) => trocarStatus(valor as ClientStatus)}
          />
          <Dados
            itens={[
              ['Tempo de casa', cliente.data_inicio_contrato ? fidelidadeDoCliente(cliente) : 'Sem data de início'],
              ['CNPJ ou CPF', cliente.cnpj ?? 'Não informado'],
              ...(colunas.baseDeClientes
                ? ([
                    ['Área de atuação', cliente.area_atuacao ?? 'Não informada'],
                    ['Responsáveis da SINGLE', responsaveis.length > 0 ? responsaveis.join(', ') : 'Ninguém definido'],
                  ] as [string, string][])
                : []),
            ]}
          />
          <AreaTexto
            rotulo="Observações"
            placeholder="Anote aqui o que a equipe precisa saber. Salva ao sair do campo."
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
            onBlur={salvarObservacoes}
          />
        </div>
      </Painel>

      <Painel titulo="Canais">
        <div className={styles.secao}>
          {/* Um bloco por contato: com várias pessoas o bloco as resume como responsáveis */}
          {contatos.map((c, i) => (
            <BlocoDeVinculo
              key={i}
              empresa={i === 0 ? { nome: cliente.nome, logoUrl: cliente.logo_url } : undefined}
              pessoas={[{ nome: c.nome || 'Sem nome', detalhe: c.funcao ?? 'Contato' }]}
            />
          ))}
          <ul className={styles.canais}>
            <Canal icone="instagram" rotulo="Instagram">
              {instagram ? (
                <a href={instagram} target="_blank" rel="noopener noreferrer" className={ui.linkAcao}>
                  {cliente.instagram}
                </a>
              ) : (
                <span className={ui.mudo}>{cliente.instagram ?? 'Não informado'}</span>
              )}
            </Canal>
            <Canal icone="campanhas" rotulo="Conta de anúncios">
              {cliente.link_conta_anuncios ? (
                <a
                  href={cliente.link_conta_anuncios}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ui.linkAcao}
                >
                  {plataformaDoLink(cliente.link_conta_anuncios)}
                </a>
              ) : (
                <span className={ui.mudo}>Não informada</span>
              )}
            </Canal>
            <Canal icone="email" rotulo="E-mail">
              {cliente.contato_email ? (
                <a href={`mailto:${cliente.contato_email}`} className={ui.linkAcao}>
                  {cliente.contato_email}
                </a>
              ) : (
                <span className={ui.mudo}>Não informado</span>
              )}
            </Canal>
            <Canal icone="telefone" rotulo="Telefone">
              {cliente.contato_telefone ? (
                <span className={styles.telefone}>
                  <span>{cliente.contato_telefone}</span>
                  {whatsapp && (
                    <a
                      href={whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.whatsapp}
                      aria-label={`Abrir WhatsApp de ${cliente.contato_nome ?? cliente.nome}`}
                    >
                      <Icone nome="whatsapp" tamanho={16} />
                      WhatsApp
                    </a>
                  )}
                </span>
              ) : (
                <span className={ui.mudo}>Não informado</span>
              )}
            </Canal>
          </ul>
        </div>
      </Painel>

      <Painel titulo="Contrato">
        <div className={styles.secao}>
          <Dados
            itens={[
              ['Início', cliente.data_inicio_contrato ? formatarData(cliente.data_inicio_contrato) : 'Não informado'],
              ['Duração', cliente.contrato_meses ? `${cliente.contrato_meses} meses` : 'Sem fidelidade'],
              ['Fim', fim ? formatarData(fim) : '—'],
              ['Situação', selo ? <Pill tom={selo.tom}>{selo.texto}</Pill> : 'Sem duração definida'],
            ]}
          />
        </div>
      </Painel>

      {lideranca && (
        <Painel titulo="Financeiro">
          <div className={styles.secao}>
            <Dados itens={[['Valor mensal do contrato', formatarMoeda(Number(cliente.mrr))]]} />
            <p className={ui.mudo}>Cobranças e pagamentos, como estão no Asaas, ficam na aba Pagamentos.</p>
          </div>
        </Painel>
      )}
    </div>
  )
}

interface ItemDaLista {
  id: string
  titulo: string
  rota: string
  detalhe: ReactNode
}

function ListaDoCliente({
  itens,
  vazio,
  ilustracao,
}: {
  itens: ItemDaLista[]
  vazio: string
  ilustracao: NomeIlustracao
}) {
  if (itens.length === 0) return <EstadoVazio ilustracao={ilustracao} titulo={vazio} />
  return (
    <div className={ui.painel}>
      <ul className={`${ui.lista} stagger`}>
        {itens.map((item) => (
          <li key={item.id} className={ui.linha}>
            <div className={ui.linhaTexto}>
              <Link to={item.rota} className={ui.linhaTitulo}>
                {item.titulo}
              </Link>
            </div>
            {item.detalhe}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ClientePage() {
  const { id } = useParams()
  const { perfil } = useAuth()
  const clientes = useClientes()
  const tarefas = useTarefas()
  const campanhas = useCampanhas()
  const cards = useCards()
  const atualizar = useAtualizarOtimista<Client>('clients')
  const toast = useToast()
  const [aba, setAba] = useState<Aba>('visao')
  const [editando, setEditando] = useState(false)
  const [enviandoLogo, setEnviandoLogo] = useState(false)

  const consultas = juntarConsultas(clientes, tarefas, campanhas, cards)
  const cliente = clientes.data?.find((c) => c.id === id)
  const lideranca = isLideranca(perfil?.cargo)

  if (consultas.erro) return <EstadoErro onTentar={consultas.tentar} />

  if (consultas.carregando) {
    return (
      <div className={styles.pagina} aria-busy="true">
        <Skeleton altura="96px" raio="var(--radius)" />
        <Skeleton altura="260px" raio="var(--radius)" />
      </div>
    )
  }

  if (!cliente) {
    return (
      <EstadoVazio
        ilustracao="busca"
        titulo="Cliente não encontrado."
        texto="Ele pode ter sido removido ou o endereço está incorreto."
        acao={
          <Link to="/app/clientes" className={ui.linkAcao}>
            Voltar para Clientes
          </Link>
        }
      />
    )
  }

  async function aoEscolherLogo(evento: ChangeEvent<HTMLInputElement>, alvo: Client) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    const recusa = validarImagem(arquivo)
    if (recusa) {
      toast.erro(recusa)
      return
    }
    setEnviandoLogo(true)
    try {
      const logo_url = await enviarImagem('logos', alvo.id, arquivo)
      await atualizar.mutateAsync({ id: alvo.id, valores: { logo_url } })
      toast.sucesso('Logo atualizada.')
    } catch {
      toast.erro('Não foi possível enviar a logo.')
    } finally {
      setEnviandoLogo(false)
    }
  }

  const status = opcao(STATUS_CLIENTE, cliente.status)
  // Pagamentos são bloqueados pelo banco para quem não é da liderança; a aba nem aparece
  const abas = ABAS.filter((item) => item.id !== 'pagamentos' || lideranca)
  const ativa = abas.some((item) => item.id === aba) ? aba : 'visao'

  const demandas: ItemDaLista[] = (tarefas.data ?? [])
    .filter((t) => t.client_id === cliente.id)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo,
      rota: rotaDaTarefa(t),
      detalhe: (
        <>
          {t.data_entrega && <span className={ui.mudo}>{formatarData(t.data_entrega)}</span>}
          <Pill tom="cinza">{tituloDe(COLUNAS_TAREFA, t.status)}</Pill>
        </>
      ),
    }))
  const campanhasDoCliente: ItemDaLista[] = (campanhas.data ?? [])
    .filter((c) => c.client_id === cliente.id)
    .map((c) => {
      const situacao = opcao(STATUS_CAMPANHA, c.status)
      return {
        id: c.id,
        titulo: c.nome,
        rota: `/app/anuncios/${c.id}`,
        detalhe: (
          <>
            <span className={ui.mudo}>{formatarMoeda(Number(c.orcamento))}</span>
            <Pill tom={situacao.tom}>{situacao.rotulo}</Pill>
          </>
        ),
      }
    })
  const conteudos: ItemDaLista[] = (cards.data ?? [])
    .filter((c) => c.client_id === cliente.id)
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      rota: `/app/conteudo?abrir=${c.id}`,
      detalhe: (
        <>
          {c.data_entrega && <span className={ui.mudo}>{formatarData(c.data_entrega)}</span>}
          <Pill tom="cinza">{tituloDe(COLUNAS_CONTEUDO, c.etapa)}</Pill>
        </>
      ),
    }))

  return (
    <div className={styles.pagina}>
      <Link to="/app/clientes" className={styles.voltar}>
        <Icone nome="voltar" tamanho={16} />
        Voltar para Clientes
      </Link>

      <div className={`${ui.painel} ${styles.cabecalho}`}>
        <Avatar nome={cliente.nome} url={cliente.logo_url} tamanho={64} forma="quadrado" />
        <div className={styles.cabecalhoTexto}>
          <h2>{cliente.nome}</h2>
          <Pill tom={status.tom}>{status.rotulo}</Pill>
        </div>
        <div className={styles.identidadeAcoes}>
          <label className={styles.enviar} aria-busy={enviandoLogo || undefined}>
            <Icone nome="enviar" tamanho={16} />
            Enviar logo
            <input
              type="file"
              accept={ACEITA_IMAGENS}
              className={styles.arquivo}
              disabled={enviandoLogo}
              onChange={(evento) => void aoEscolherLogo(evento, cliente)}
            />
          </label>
          <Button variante="secundario" className={ui.botaoPequeno} onClick={() => setEditando(true)}>
            Editar
          </Button>
        </div>
      </div>

      <Abas rotulo="Seções do cliente" abas={abas} ativa={ativa} onMudar={setAba}>
        {ativa === 'visao' && <VisaoGeral key={cliente.id} cliente={cliente} lideranca={lideranca} />}
        {ativa === 'pagamentos' && (
          <div className={ui.painel}>
            <Pagamentos cliente={cliente} />
          </div>
        )}
        {ativa === 'demandas' && (
          <ListaDoCliente
            itens={demandas}
            ilustracao="quadro"
            vazio="Nenhuma demanda para este cliente."
          />
        )}
        {ativa === 'campanhas' && (
          <ListaDoCliente
            itens={campanhasDoCliente}
            ilustracao="campanhas"
            vazio="Nenhum anúncio para este cliente."
          />
        )}
        {ativa === 'conteudos' && (
          <ListaDoCliente
            itens={conteudos}
            ilustracao="quadro"
            vazio="Nenhum conteúdo para este cliente."
          />
        )}
      </Abas>

      {editando && <ClienteModal cliente={cliente} onFechar={() => setEditando(false)} />}
    </div>
  )
}
