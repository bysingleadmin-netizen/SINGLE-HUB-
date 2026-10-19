import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Icone } from '@/components/ui/Icone'
import { Logotipo } from '@/components/ui/Logotipo'
import { Skeleton } from '@/components/ui/Skeleton'
import { supabase } from '@/lib/supabase'
import type { ItemDeAprovacao, StatusAprovacao } from '@/types/database'
import { Lightbox } from './Lightbox'
import type { PedidoPublico, RespostaDoPortal } from './aprovacao'
import styles from './portal.module.css'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Modo = 'escolher' | 'revisao' | 'reprovar'

/** Nome do item para o cliente: o que a equipe escreveu, ou o tipo com o número */
function rotuloDo(item: ItemDeAprovacao, i: number): string {
  if (item.label) return item.label
  const nome = { copy: 'Texto', imagem: 'Imagem', video: 'Vídeo', link: 'Link' }[item.tipo]
  return `${nome} ${i + 1}`
}

function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Portal do cliente: abre pelo link mágico, sem login e sem o menu do sistema. Mostra os
 * materiais do pedido e recebe uma resposta só (aprovar, pedir revisão ou reprovar).
 */
export function AprovarPage() {
  const { token = '' } = useParams()
  const valido = UUID.test(token)
  const pedido = useQuery({
    queryKey: ['aprovacao-publica', token],
    enabled: valido,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('aprovacao_por_token', { p_token: token })
      if (error) throw error
      return (data ?? null) as PedidoPublico | null
    },
  })
  const [respondido, setRespondido] = useState<StatusAprovacao>()

  let corpo
  if (!valido || pedido.data === null) {
    corpo = (
      <Aviso icone="alerta" titulo="Link inválido ou expirado">
        Peça um novo link para a equipe da SINGLE.
      </Aviso>
    )
  } else if (pedido.isError) {
    corpo = (
      <Aviso icone="alerta" titulo="Não foi possível abrir o material">
        Confira a sua conexão e tente de novo.
        <button type="button" className={styles.botaoTexto} onClick={() => void pedido.refetch()}>
          Tentar de novo
        </button>
      </Aviso>
    )
  } else if (!pedido.data) {
    corpo = (
      <div className={styles.lista} aria-busy="true">
        <Skeleton altura="28px" largura="60%" />
        <Skeleton altura="220px" raio="var(--radius)" />
        <Skeleton altura="140px" raio="var(--radius)" />
      </div>
    )
  } else if (respondido) {
    corpo = <Confirmacao status={respondido} />
  } else if (pedido.data.status !== 'pendente') {
    corpo = (
      <Aviso icone="confirmar" titulo="Você já respondeu esta aprovação">
        {pedido.data.status === 'aprovado'
          ? 'O material foi aprovado. Obrigado!'
          : pedido.data.status === 'revisao'
            ? 'Você pediu uma revisão. A equipe já está ajustando.'
            : 'Você reprovou este material. A equipe vai entrar em contato.'}
        {pedido.data.comentario && <blockquote className={styles.citacao}>{pedido.data.comentario}</blockquote>}
      </Aviso>
    )
  } else {
    corpo = (
      <Materiais
        token={token}
        pedido={pedido.data}
        onRespondido={setRespondido}
        onExpirado={() => void pedido.refetch()}
      />
    )
  }

  return (
    <div className={styles.portal}>
      <header className={styles.topo}>
        <Logotipo altura={18} />
      </header>
      <main className={styles.conteudo}>{corpo}</main>
    </div>
  )
}

function Aviso({
  icone,
  titulo,
  children,
}: {
  icone: 'alerta' | 'confirmar'
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section className={styles.aviso}>
      <span className={styles.avisoIcone} data-icone={icone}>
        <Icone nome={icone} tamanho={28} />
      </span>
      <h1 className={styles.avisoTitulo}>{titulo}</h1>
      <div className={styles.avisoTexto}>{children}</div>
    </section>
  )
}

interface MateriaisProps {
  token: string
  pedido: PedidoPublico
  onRespondido: (status: StatusAprovacao) => void
  onExpirado: () => void
}

function Materiais({ token, pedido, onRespondido, onExpirado }: MateriaisProps) {
  const [modo, setModo] = useState<Modo>('escolher')
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState<StatusAprovacao>()
  const [erro, setErro] = useState<string>()
  const [tremendo, setTremendo] = useState(false)
  const [aberta, setAberta] = useState<number>()
  const campo = useRef<HTMLTextAreaElement>(null)

  const imagens = pedido.conteudo
    .map((item, i) => ({ item, i }))
    .filter(({ item }) => item.tipo === 'imagem')
    .map(({ item, i }) => ({ url: item.valor, rotulo: rotuloDo(item, i) }))

  useEffect(() => {
    if (modo !== 'escolher') campo.current?.focus()
  }, [modo])

  function pedirRevisao() {
    setModo('revisao')
    setErro(undefined)
    setTremendo(true)
  }

  async function responder(status: Exclude<StatusAprovacao, 'pendente'>) {
    if (status === 'revisao' && comentario.trim() === '') {
      setErro('Conte o que precisa mudar.')
      setTremendo(true)
      campo.current?.focus()
      return
    }
    setErro(undefined)
    setEnviando(status)
    const { data, error } = await supabase.rpc('responder_aprovacao', {
      p_token: token,
      p_status: status,
      p_comentario: status === 'aprovado' ? null : comentario,
    })
    setEnviando(undefined)
    const resposta = data as RespostaDoPortal | null
    if (error || !resposta) {
      setErro('Não foi possível enviar. Confira a conexão e tente de novo.')
      return
    }
    if (resposta === 'ok') onRespondido(status)
    else if (resposta === 'comentario_obrigatorio') setErro('Conte o que precisa mudar.')
    else onExpirado()
  }

  return (
    <>
      <div className={styles.cabecalho}>
        <p className={styles.sobretitulo}>Aprovação de material</p>
        <h1 className={styles.titulo}>{pedido.titulo}</h1>
        <p className={styles.instrucao}>Confira cada item e responda no fim da página.</p>
      </div>

      <ol
        className={styles.lista}
        data-tremendo={tremendo || undefined}
        // Só o fim do tremor da lista; a entrada de cada item também dispara este evento
        onAnimationEnd={(evento) => evento.target === evento.currentTarget && setTremendo(false)}
      >
        {pedido.conteudo.map((item, i) => (
          <li key={i} className={styles.item}>
            <ItemDoPortal
              item={item}
              rotulo={rotuloDo(item, i)}
              onAbrirImagem={() => setAberta(imagens.findIndex((img) => img.url === item.valor))}
            />
          </li>
        ))}
      </ol>

      <footer className={styles.acoes} data-modo={modo}>
        {modo === 'escolher' ? (
          <div className={styles.acoesBotoes}>
            <button
              type="button"
              className={styles.aprovar}
              disabled={enviando != null}
              aria-busy={enviando === 'aprovado' || undefined}
              onClick={() => void responder('aprovado')}
            >
              <Icone nome="confirmar" tamanho={20} />
              {enviando === 'aprovado' ? 'Enviando…' : 'Aprovar'}
            </button>
            <div className={styles.acoesSecundarias}>
              <button type="button" className={styles.revisar} onClick={pedirRevisao}>
                <Icone nome="editar" tamanho={18} />
                Solicitar revisão
              </button>
              <button type="button" className={styles.reprovar} onClick={() => setModo('reprovar')}>
                <Icone nome="fechar" tamanho={18} />
                Reprovar
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.comentarioCaixa}>
            <label htmlFor="comentario" className={styles.comentarioRotulo}>
              {modo === 'revisao' ? 'O que precisa mudar?' : 'Quer contar o motivo? (opcional)'}
            </label>
            <textarea
              id="comentario"
              ref={campo}
              className={styles.comentarioCampo}
              rows={3}
              maxLength={2000}
              placeholder={modo === 'revisao' ? 'Ex.: trocar a foto do item 2 e encurtar a legenda' : ''}
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
            />
            {erro && (
              <p className={styles.erro} role="alert">
                {erro}
              </p>
            )}
            <div className={styles.acoesSecundarias}>
              <button
                type="button"
                className={styles.voltar}
                onClick={() => {
                  setModo('escolher')
                  setErro(undefined)
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                className={modo === 'revisao' ? styles.enviarRevisao : styles.confirmarReprovacao}
                disabled={enviando != null}
                onClick={() => void responder(modo === 'revisao' ? 'revisao' : 'reprovado')}
              >
                {enviando ? 'Enviando…' : modo === 'revisao' ? 'Enviar pedido de revisão' : 'Confirmar reprovação'}
              </button>
            </div>
          </div>
        )}
        {modo === 'escolher' && erro && (
          <p className={styles.erro} role="alert">
            {erro}
          </p>
        )}
      </footer>

      {aberta != null && aberta >= 0 && (
        <Lightbox imagens={imagens} inicial={aberta} onFechar={() => setAberta(undefined)} />
      )}
    </>
  )
}

function ItemDoPortal({
  item,
  rotulo,
  onAbrirImagem,
}: {
  item: ItemDeAprovacao
  rotulo: string
  onAbrirImagem: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(item.valor)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sem permissão de área de transferência: o texto continua selecionável na tela
    }
  }

  return (
    <article className={styles.card} aria-label={rotulo}>
      <header className={styles.cardTopo}>
        <h2 className={styles.cardRotulo}>{rotulo}</h2>
        {item.tipo === 'copy' && (
          <button type="button" className={styles.copiar} onClick={() => void copiar()}>
            <Icone nome={copiado ? 'confirmar' : 'vinculo'} tamanho={15} />
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </header>
      {item.tipo === 'copy' && <p className={styles.copy}>{item.valor}</p>}
      {item.tipo === 'imagem' && (
        <button type="button" className={styles.imagem} onClick={onAbrirImagem} aria-label={`Ampliar ${rotulo}`}>
          <img src={item.valor} alt={rotulo} loading="lazy" />
          <span className={styles.ampliar} aria-hidden="true">
            <Icone nome="busca" tamanho={16} />
          </span>
        </button>
      )}
      {item.tipo === 'video' && (
        // #t=0.1 faz o navegador mostrar o primeiro quadro como capa, inclusive no iPhone
        <video className={styles.video} src={`${item.valor}#t=0.1`} controls playsInline preload="metadata">
          <a href={item.valor}>Abrir o vídeo</a>
        </video>
      )}
      {item.tipo === 'link' && (
        <a className={styles.linkExterno} href={item.valor} target="_blank" rel="noopener noreferrer">
          <Icone nome="externo" tamanho={18} />
          <span>{dominio(item.valor)}</span>
        </a>
      )}
    </article>
  )
}

const CORES_DO_CONFETE = ['var(--verde)', 'var(--amarelo)', 'var(--azul)', 'var(--roxo)', 'var(--accent)']

/** Tela depois da resposta: o check verde com confete na aprovação. */
function Confirmacao({ status }: { status: StatusAprovacao }) {
  if (status !== 'aprovado') {
    return (
      <Aviso icone="confirmar" titulo={status === 'revisao' ? 'Pedido de revisão enviado' : 'Resposta enviada'}>
        {status === 'revisao'
          ? 'A equipe da SINGLE recebeu o seu pedido e vai ajustar o material.'
          : 'A equipe da SINGLE recebeu a sua resposta e vai entrar em contato.'}
      </Aviso>
    )
  }
  return (
    <section className={styles.aprovado} aria-live="polite">
      <div className={styles.confete} aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => {
          const angulo = (i / 28) * Math.PI * 2
          const raio = 90 + (i % 4) * 28
          return (
            <span
              key={i}
              style={
                {
                  '--x': `${Math.cos(angulo) * raio}px`,
                  '--y': `${Math.sin(angulo) * raio - 30}px`,
                  '--giro': `${(i * 47) % 360}deg`,
                  '--cor': CORES_DO_CONFETE[i % CORES_DO_CONFETE.length],
                  '--atraso': `${(i % 5) * 30}ms`,
                } as React.CSSProperties
              }
            />
          )
        })}
      </div>
      <svg className={styles.check} viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24" />
        <path d="m15 27 7.5 7.5L38 19" />
      </svg>
      <h1 className={styles.avisoTitulo}>Material aprovado!</h1>
      <p className={styles.avisoTexto}>Obrigado. A equipe da SINGLE já foi avisada.</p>
    </section>
  )
}
