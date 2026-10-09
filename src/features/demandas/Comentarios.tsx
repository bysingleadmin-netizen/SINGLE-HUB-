import { useState } from 'react'
import type { FormEvent } from 'react'
import styles from '@/components/quadro/detalhe.module.css'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { porId } from '@/dados/base'
import { useComentar, useComentarios } from '@/dados/comentarios'
import { useAuth } from '@/features/auth/AuthContext'
import { tempoRelativo } from '@/lib/regras'
import type { Profile } from '@/types/database'

/** Conversa da equipe dentro da demanda. Some inteira se o banco não entregar os comentários. */
export function Comentarios({ tarefaId, perfis }: { tarefaId: string; perfis: Profile[] }) {
  const { perfil } = useAuth()
  const { porTarefa, disponivel } = useComentarios()
  const comentar = useComentar()
  const toast = useToast()
  const [texto, setTexto] = useState('')

  if (!disponivel) return null

  const lista = porTarefa.get(tarefaId) ?? []
  const perfilPorId = porId(perfis)

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = texto.trim()
    if (limpo === '') return
    comentar.mutate(
      { task_id: tarefaId, author_id: perfil?.id ?? null, conteudo: limpo },
      {
        onSuccess: () => setTexto(''),
        onError: () => toast.erro('Não foi possível enviar o comentário.'),
      },
    )
  }

  return (
    <section className={styles.bloco} aria-label="Comentários">
      <h3 className={styles.blocoTitulo}>Comentários</h3>
      {lista.length === 0 ? (
        <p className={ui.mudo}>Nenhum comentário ainda.</p>
      ) : (
        <ul className={styles.comentarios}>
          {lista.map((comentario) => {
            const autor = comentario.author_id ? perfilPorId.get(comentario.author_id) : undefined
            return (
              <li key={comentario.id} className={styles.comentario}>
                <Avatar nome={autor?.nome ?? null} url={autor?.avatar_url} tamanho={28} />
                <div className={styles.comentarioCorpo}>
                  <span className={styles.comentarioTopo}>
                    <strong>{autor?.nome ?? 'Alguém'}</strong>
                    <span className={styles.comentarioQuando}>
                      {tempoRelativo(comentario.created_at)}
                    </span>
                  </span>
                  <p className={styles.comentarioTexto}>{comentario.conteudo}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <form className={styles.comentar} onSubmit={aoEnviar}>
        <AreaTexto
          rotulo="Novo comentário"
          rows={2}
          placeholder="Escreva para a equipe"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
        />
        <Button
          type="submit"
          variante="secundario"
          className={ui.botaoPequeno}
          carregando={comentar.isPending}
        >
          Comentar
        </Button>
      </form>
    </section>
  )
}
