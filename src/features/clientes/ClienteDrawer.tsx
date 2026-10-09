import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Icone } from '@/components/ui/Icone'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { ACEITA_IMAGENS, enviarImagem, validarImagem } from '@/dados/arquivos'
import { useAtualizarOtimista } from '@/dados/base'
import { useAuth } from '@/features/auth/AuthContext'
import { hojeISO, mesesCompletos } from '@/lib/datas'
import { formatarData, formatarMoeda } from '@/lib/formato'
import { textoOuNull } from '@/lib/formulario'
import { isLideranca } from '@/lib/permissoes'
import { formatarFidelidade } from '@/lib/regras'
import { STATUS_CLIENTE } from '@/lib/rotulos'
import type { Client, ClientStatus } from '@/types/database'
import { linkInstagram } from './cliente'
import { Pagamentos } from './Pagamentos'
import styles from './clientes.module.css'

export function fidelidadeDoCliente(cliente: Pick<Client, 'data_inicio_contrato'>): string {
  return cliente.data_inicio_contrato
    ? formatarFidelidade(mesesCompletos(cliente.data_inicio_contrato, hojeISO()))
    : 'Sem data de início'
}

interface ClienteDrawerProps {
  cliente: Client
  onEditar: () => void
  onFechar: () => void
}

export function ClienteDrawer({ cliente, onEditar, onFechar }: ClienteDrawerProps) {
  const { perfil } = useAuth()
  const atualizar = useAtualizarOtimista<Client>('clients')
  const toast = useToast()
  const [observacoes, setObservacoes] = useState(cliente.observacoes ?? '')
  const [enviandoLogo, setEnviandoLogo] = useState(false)

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

  async function aoEscolherLogo(evento: ChangeEvent<HTMLInputElement>) {
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
      const logo_url = await enviarImagem('logos', cliente.id, arquivo)
      await atualizar.mutateAsync({ id: cliente.id, valores: { logo_url } })
      toast.sucesso('Logo atualizada.')
    } catch {
      toast.erro('Não foi possível enviar a logo.')
    } finally {
      setEnviandoLogo(false)
    }
  }

  return (
    <Drawer aberto titulo={cliente.nome} onFechar={onFechar}>
      <div className={styles.detalhe}>
        <div className={styles.identidade}>
          <Avatar nome={cliente.nome} url={cliente.logo_url} tamanho={72} />
          <div className={styles.identidadeAcoes}>
            <label className={styles.enviar} aria-busy={enviandoLogo || undefined}>
              <Icone nome="enviar" tamanho={16} />
              Enviar logo
              <input
                type="file"
                accept={ACEITA_IMAGENS}
                className={styles.arquivo}
                disabled={enviandoLogo}
                onChange={(evento) => void aoEscolherLogo(evento)}
              />
            </label>
            <Button variante="secundario" className={ui.botaoPequeno} onClick={onEditar}>
              Editar
            </Button>
          </div>
        </div>

        <Selecao
          rotulo="Status"
          opcoes={STATUS_CLIENTE}
          value={cliente.status}
          onChange={(evento) => trocarStatus(evento.target.value as ClientStatus)}
        />

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

        <section className={styles.secao}>
          <h3 className={styles.secaoTitulo}>Canais</h3>
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
        </section>

        <section className={styles.secao}>
          <h3 className={styles.secaoTitulo}>Contato</h3>
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
        </section>

        <AreaTexto
          rotulo="Observações"
          placeholder="Anote aqui o que a equipe precisa saber. Salva ao sair do campo."
          value={observacoes}
          onChange={(evento) => setObservacoes(evento.target.value)}
          onBlur={salvarObservacoes}
        />

        {isLideranca(perfil?.cargo) && <Pagamentos cliente={cliente} />}
      </div>
    </Drawer>
  )
}
