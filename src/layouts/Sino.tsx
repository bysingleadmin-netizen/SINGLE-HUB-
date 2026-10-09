import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EstadoVazio } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { useMarcarComoLida, useNotificacoes } from '@/dados/notificacoes'
import { plural, tempoRelativo } from '@/lib/regras'
import type { Notificacao } from '@/types/database'
import styles from './layout.module.css'

/** Só rotas do próprio app: o link vem do banco e não pode levar a pessoa para fora. */
function rotaInterna(link: string | null): string | null {
  return link && link.startsWith('/') && !link.startsWith('//') ? link : null
}

export function Sino() {
  const notificacoes = useNotificacoes()
  const marcarComoLida = useMarcarComoLida()
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)

  const lista = notificacoes.data ?? []
  const naoLidas = lista.filter((n) => !n.lida).length

  useEffect(() => {
    if (!aberto) return
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    function aoClicarFora(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    document.addEventListener('mousedown', aoClicarFora)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.removeEventListener('mousedown', aoClicarFora)
    }
  }, [aberto])

  function abrirItem(notificacao: Notificacao) {
    if (!notificacao.lida) marcarComoLida.mutate(notificacao.id)
    setAberto(false)
    const rota = rotaInterna(notificacao.link)
    if (rota) navigate(rota)
  }

  return (
    <div className={styles.sino} ref={raiz}>
      <button
        type="button"
        className={styles.botaoIcone}
        aria-label={
          naoLidas > 0
            ? `Notificações, ${plural(naoLidas, 'não lida', 'não lidas')}`
            : 'Notificações'
        }
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
      >
        <Icone nome="sino" />
        {naoLidas > 0 && (
          <span className={styles.sinoContagem} aria-hidden="true">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <section className={styles.sinoLista} aria-label="Notificações">
          <h2 className={styles.sinoTitulo}>Notificações</h2>
          {notificacoes.isError ? (
            <p className={styles.sinoAviso}>Não foi possível carregar as notificações.</p>
          ) : lista.length === 0 ? (
            <EstadoVazio ilustracao="sino" titulo="Nenhuma notificação." />
          ) : (
            <ul className={`${styles.sinoItens} stagger`}>
              {lista.map((notificacao) => (
                <li key={notificacao.id}>
                  <button
                    type="button"
                    className={styles.sinoItem}
                    data-nova={!notificacao.lida || undefined}
                    onClick={() => abrirItem(notificacao)}
                  >
                    <span className={styles.sinoItemTitulo}>{notificacao.titulo}</span>
                    {notificacao.mensagem && (
                      <span className={styles.sinoItemTexto}>{notificacao.mensagem}</span>
                    )}
                    <span className={styles.sinoItemTempo}>
                      {tempoRelativo(notificacao.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
