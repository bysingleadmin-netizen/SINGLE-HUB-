import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Icone } from '@/components/ui/Icone'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { normalizarUrl, rotuloDoAnexo, useAnexar, useRemoverAnexo } from '@/dados/anexos'
import { ACEITA_IMAGENS, validarImagem } from '@/dados/arquivos'
import type { CardAttachment, QuadroId } from '@/types/database'
import styles from './anexos.module.css'

/** Anexos de card aceitam imagens maiores que logos e avatares */
const LIMITE_MB = 5
/** Quantas imagens dá para escolher de uma vez; o card pode juntar quantas quiser */
const POR_ENVIO = 10

interface AnexosProps {
  quadro: QuadroId
  cardId: string
  anexos: CardAttachment[]
}

/** Lista os anexos do card e deixa acrescentar um link ou enviar uma imagem. */
export function Anexos({ quadro, cardId, anexos }: AnexosProps) {
  const [link, setLink] = useState('')
  const [erro, setErro] = useState<string>()
  const anexar = useAnexar(quadro, cardId)
  const remover = useRemoverAnexo()
  const toast = useToast()

  function anexarLink(evento: FormEvent) {
    evento.preventDefault()
    const url = normalizarUrl(link)
    if (!url) {
      setErro('Informe um link válido.')
      return
    }
    setErro(undefined)
    anexar.mutate(
      { tipo: 'link', url },
      {
        onSuccess: () => {
          toast.sucesso('Link anexado.')
          setLink('')
        },
        onError: () => toast.erro('Não foi possível anexar o link.'),
      },
    )
  }

  /** Várias imagens de uma vez, até POR_ENVIO; cada uma é conferida e enviada na ordem */
  async function anexarImagens(evento: ChangeEvent<HTMLInputElement>) {
    const escolhidos = [...(evento.target.files ?? [])]
    evento.target.value = ''
    if (escolhidos.length === 0) return
    if (escolhidos.length > POR_ENVIO) {
      toast.erro(`Escolha até ${POR_ENVIO} imagens por vez.`)
      return
    }
    const recusa = escolhidos.map((arquivo) => validarImagem(arquivo, LIMITE_MB)).find(Boolean)
    if (recusa) {
      toast.erro(recusa)
      return
    }
    let enviadas = 0
    try {
      for (const arquivo of escolhidos) {
        await anexar.mutateAsync({ tipo: 'imagem', arquivo })
        enviadas++
      }
      toast.sucesso(enviadas === 1 ? 'Imagem anexada.' : `${enviadas} imagens anexadas.`)
    } catch {
      toast.erro(
        enviadas === 0
          ? 'Não foi possível enviar a imagem.'
          : `${enviadas} de ${escolhidos.length} imagens anexadas; as outras não foram enviadas.`,
      )
    }
  }

  function removerAnexo(anexo: CardAttachment) {
    remover.mutate(anexo.id, {
      onSuccess: () => toast.sucesso('Anexo removido.'),
      onError: () => toast.erro('Não foi possível remover o anexo.'),
    })
  }

  return (
    <div className={styles.anexos}>
      {anexos.length === 0 ? (
        <p className={ui.mudo}>Nenhum anexo ainda.</p>
      ) : (
        <ul className={styles.lista}>
          {anexos.map((anexo) => (
            <li key={anexo.id} className={styles.item}>
              <a
                className={styles.itemLink}
                href={anexo.url}
                target="_blank"
                rel="noreferrer"
                title={anexo.url}
              >
                {anexo.tipo === 'imagem' ? (
                  <img className={styles.itemImagem} src={anexo.url} alt="" />
                ) : (
                  <span className={styles.itemIcone}>
                    <Icone nome="externo" tamanho={16} />
                  </span>
                )}
                <span className={styles.itemNome}>{rotuloDoAnexo(anexo)}</span>
              </a>
              <button
                type="button"
                className={ui.botaoIcone}
                aria-label={`Remover anexo ${rotuloDoAnexo(anexo)}`}
                title="Remover"
                onClick={() => removerAnexo(anexo)}
              >
                <Icone nome="lixeira" tamanho={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className={styles.novoLink} onSubmit={anexarLink} noValidate>
        <Campo
          rotulo="Link"
          inputMode="url"
          placeholder="https://"
          value={link}
          erro={erro}
          onChange={(evento) => setLink(evento.target.value)}
        />
        <Button type="submit" variante="secundario" carregando={anexar.isPending}>
          Anexar link
        </Button>
      </form>

      <label className={styles.enviar} aria-busy={anexar.isPending || undefined}>
        <Icone nome="enviar" tamanho={16} />
        Enviar imagens (até {POR_ENVIO} por vez)
        <input
          type="file"
          accept={ACEITA_IMAGENS}
          multiple
          className={ui.somenteLeitor}
          disabled={anexar.isPending}
          onChange={(evento) => void anexarImagens(evento)}
        />
      </label>
    </div>
  )
}
