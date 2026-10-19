import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import anexosCss from '@/components/quadro/anexos.module.css'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useCriarAprovacao } from '@/dados/aprovacoes'
import { ACEITA_IMAGENS, ACEITA_VIDEOS, validarImagem, validarVideo } from '@/dados/arquivos'
import type { Aprovacao, CardAttachment, ContentCard, TipoDeItem } from '@/types/database'
import { LinkGerado } from './LinkGerado'
import { TIPOS_DE_ITEM, itemVazio, itensDosAnexos, problemaDosItens } from './aprovacao'
import type { ItemDoForm } from './aprovacao'
import styles from './aprovacao.module.css'

const IMAGEM_MAXIMA_MB = 10

interface GerarAprovacaoModalProps {
  card: Pick<ContentCard, 'id' | 'titulo' | 'client_id'>
  /** Os anexos do card entram como primeiros itens */
  anexos: Pick<CardAttachment, 'tipo' | 'url' | 'nome'>[]
  /** Telefone do contato do cliente, para o botão do WhatsApp */
  telefone: string | null
  onFechar: () => void
}

/** Monta o pedido de aprovação (textos, imagens, vídeos e links) e mostra o link para enviar. */
export function GerarAprovacaoModal({ card, anexos, telefone, onFechar }: GerarAprovacaoModalProps) {
  const [itens, setItens] = useState<ItemDoForm[]>(() =>
    anexos.length > 0 ? itensDosAnexos(anexos) : [itemVazio('copy')],
  )
  const [erro, setErro] = useState<string>()
  const [gerada, setGerada] = useState<Aprovacao>()
  const criar = useCriarAprovacao(card)
  const toast = useToast()

  function mudar(indice: number, mudanca: Partial<ItemDoForm>) {
    setItens((atuais) => atuais.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)))
  }

  function escolherArquivo(indice: number, tipo: TipoDeItem, evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    const recusa = tipo === 'video' ? validarVideo(arquivo) : validarImagem(arquivo, IMAGEM_MAXIMA_MB)
    if (recusa) {
      toast.erro(recusa)
      return
    }
    mudar(indice, { arquivo, valor: '', label: itens[indice].label || arquivo.name })
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const problema = problemaDosItens(itens)
    if (problema) {
      setErro(problema)
      return
    }
    setErro(undefined)
    criar.mutate(itens, {
      onSuccess: (aprovacao) => setGerada(aprovacao),
      onError: () => toast.erro('Não foi possível gerar o link. Tente de novo.'),
    })
  }

  if (gerada) {
    return (
      <Modal aberto titulo="Link de aprovação pronto" onFechar={onFechar}>
        <div className={ui.formulario}>
          <p className={ui.mudo}>
            Envie para o cliente. O link abre sem login, vale por 24 horas e aceita uma resposta só.
          </p>
          <LinkGerado aprovacao={gerada} telefone={telefone} />
          <div className={ui.acoes}>
            <Button onClick={onFechar}>Concluir</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal aberto titulo="Gerar link de aprovação" onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <p className={ui.mudo}>
          O cliente vê cada item num card e aprova, pede revisão ou reprova tudo de uma vez.
        </p>
        <ol className={styles.itensForm}>
          {itens.map((item, i) => (
            <li key={i}>
              <fieldset className={styles.itemForm}>
                <legend className={styles.itemLegenda}>Item {i + 1}</legend>
                {itens.length > 1 && (
                  <button
                    type="button"
                    className={styles.itemRemover}
                    aria-label={`Remover item ${i + 1}`}
                    onClick={() => setItens((atuais) => atuais.filter((_, j) => j !== i))}
                  >
                    <Icone nome="lixeira" tamanho={15} />
                  </button>
                )}
                <div className={ui.duasColunas}>
                  <Selecao
                    rotulo="Tipo"
                    opcoes={TIPOS_DE_ITEM}
                    value={item.tipo}
                    onChange={(evento) =>
                      mudar(i, { tipo: evento.target.value as TipoDeItem, valor: '', arquivo: undefined })
                    }
                  />
                  <Campo
                    rotulo="Nome para o cliente"
                    placeholder="Legenda — opção 1"
                    value={item.label}
                    onChange={(evento) => mudar(i, { label: evento.target.value })}
                  />
                </div>
                {item.tipo === 'copy' && (
                  <AreaTexto
                    rotulo="Texto"
                    rows={5}
                    placeholder="Cole a legenda ou o roteiro. As quebras de linha aparecem para o cliente."
                    value={item.valor}
                    onChange={(evento) => mudar(i, { valor: evento.target.value })}
                  />
                )}
                {item.tipo === 'link' && (
                  <Campo
                    rotulo="Link"
                    inputMode="url"
                    placeholder="https://"
                    value={item.valor}
                    onChange={(evento) => mudar(i, { valor: evento.target.value })}
                  />
                )}
                {(item.tipo === 'imagem' || item.tipo === 'video') && (
                  <div className={styles.arquivo}>
                    {item.arquivo ? (
                      <p className={styles.arquivoEscolhido}>
                        <Icone nome="anexo" tamanho={15} />
                        <span>{item.arquivo.name}</span>
                        <button
                          type="button"
                          className={ui.linkAcao}
                          onClick={() => mudar(i, { arquivo: undefined })}
                        >
                          Trocar
                        </button>
                      </p>
                    ) : (
                      <>
                        <label className={anexosCss.enviar}>
                          <Icone nome="enviar" tamanho={16} />
                          {item.tipo === 'video' ? 'Enviar vídeo (até 50 MB)' : 'Enviar imagem'}
                          <input
                            type="file"
                            accept={item.tipo === 'video' ? ACEITA_VIDEOS : ACEITA_IMAGENS}
                            className={ui.somenteLeitor}
                            onChange={(evento) => escolherArquivo(i, item.tipo, evento)}
                          />
                        </label>
                        <Campo
                          rotulo="ou cole o endereço"
                          inputMode="url"
                          placeholder="https://"
                          value={item.valor}
                          onChange={(evento) => mudar(i, { valor: evento.target.value })}
                        />
                      </>
                    )}
                  </div>
                )}
              </fieldset>
            </li>
          ))}
        </ol>
        <div className={styles.adicionar}>
          {TIPOS_DE_ITEM.map((tipo) => (
            <Button
              key={tipo.valor}
              variante="fantasma"
              onClick={() => setItens((atuais) => [...atuais, itemVazio(tipo.valor)])}
            >
              <Icone nome="mais" tamanho={15} />
              {tipo.rotulo}
            </Button>
          ))}
        </div>
        {erro && <p className={ui.campoErro}>{erro}</p>}
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={criar.isPending}>
            Gerar link
          </Button>
        </div>
      </form>
    </Modal>
  )
}
