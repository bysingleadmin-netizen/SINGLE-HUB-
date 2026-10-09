import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Abas } from '@/components/ui/Abas'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EstadoErro, EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import type { NomeIlustracao } from '@/components/ui/Ilustracao'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { ACEITA_IMAGENS, enviarImagem, validarImagem } from '@/dados/arquivos'
import { juntarConsultas, useAtualizarOtimista } from '@/dados/base'
import { useCampanhas, useCards, useClientes, useTarefas } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
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
import { ClienteModal } from './ClienteModal'
import { Pagamentos } from './Pagamentos'
import { fidelidadeDoCliente, linkInstagram } from './cliente'
import styles from './clientes.module.css'

type Aba = 'visao' | 'pagamentos' | 'demandas' | 'campanhas' | 'conteudos'

const ABAS: readonly { id: Aba; rotulo: string }[] = [
  { id: 'visao', rotulo: 'Visão Geral' },
  { id: 'pagamentos', rotulo: 'Pagamentos' },
  { id: 'demandas', rotulo: 'Demandas' },
  { id: 'campanhas', rotulo: 'Campanhas' },
  { id: 'conteudos', rotulo: 'Conteúdos' },
]

function tituloDe(colunas: readonly { id: string; titulo: string }[], id: string): string {
  return colunas.find((coluna) => coluna.id === id)?.titulo ?? 'Arquivado'
}

function VisaoGeral({ cliente }: { cliente: Client }) {
  const atualizar = useAtualizarOtimista<Client>('clients')
  const toast = useToast()
  const [observacoes, setObservacoes] = useState(cliente.observacoes ?? '')
  const mrr = Number(cliente.mrr)
  const instagram = linkInstagram(cliente.instagram)

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
    <>
      <dl className={styles.numeros}>
        <div>
          <dt>MRR</dt>
          <dd>{formatarMoeda(mrr)}</dd>
        </div>
        <div>
          <dt>ARR</dt>
          <dd>{formatarMoeda(mrr * 12)}</dd>
        </div>
        <div>
          <dt>Fidelidade</dt>
          <dd>{fidelidadeDoCliente(cliente)}</dd>
        </div>
      </dl>

      <div className={styles.duasColunas}>
        <Painel titulo="Canais">
          <div className={styles.secao}>
            {cliente.data_inicio_contrato && (
              <p className={ui.mudo}>Contrato desde {formatarData(cliente.data_inicio_contrato)}</p>
            )}
            {instagram ? (
              <a href={instagram} target="_blank" rel="noopener noreferrer" className={ui.linkAcao}>
                {cliente.instagram}
              </a>
            ) : (
              <p className={ui.mudo}>{cliente.instagram ?? 'Instagram não informado'}</p>
            )}
            {cliente.link_conta_anuncios ? (
              <a
                href={cliente.link_conta_anuncios}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.botaoLink}
              >
                <Icone nome="externo" tamanho={16} />
                Abrir conta de anúncios
              </a>
            ) : (
              <p className={ui.mudo}>Conta de anúncios não informada</p>
            )}
          </div>
        </Painel>

        <Painel titulo="Contato">
          <div className={styles.secao}>
            {cliente.contato_nome || cliente.contato_email || cliente.contato_telefone ? (
              <>
                {cliente.contato_nome && <p>{cliente.contato_nome}</p>}
                {cliente.contato_email && (
                  <a href={`mailto:${cliente.contato_email}`} className={ui.linkAcao}>
                    {cliente.contato_email}
                  </a>
                )}
                {cliente.contato_telefone && <p className={ui.mudo}>{cliente.contato_telefone}</p>}
              </>
            ) : (
              <p className={ui.mudo}>Nenhum contato informado</p>
            )}
          </div>
        </Painel>
      </div>

      <div className={ui.painel}>
        <Selecao
          className={styles.status}
          rotulo="Status"
          opcoes={STATUS_CLIENTE}
          value={cliente.status}
          onChange={(evento) => trocarStatus(evento.target.value as ClientStatus)}
        />
        <AreaTexto
          rotulo="Observações"
          placeholder="Anote aqui o que a equipe precisa saber. Salva ao sair do campo."
          value={observacoes}
          onChange={(evento) => setObservacoes(evento.target.value)}
          onBlur={salvarObservacoes}
        />
      </div>
    </>
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
      rota: `/app/demandas?abrir=${t.id}`,
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
        rota: `/app/campanhas/${c.id}`,
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
        <Avatar nome={cliente.nome} url={cliente.logo_url} tamanho={64} />
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
        {ativa === 'visao' && <VisaoGeral key={cliente.id} cliente={cliente} />}
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
            vazio="Nenhuma campanha para este cliente."
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
