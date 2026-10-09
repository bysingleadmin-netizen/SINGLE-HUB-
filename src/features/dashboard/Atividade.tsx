import { Avatar } from '@/components/ui/Avatar'
import { Icone } from '@/components/ui/Icone'
import type { NomeIcone } from '@/components/ui/Icone'
import ui from '@/components/ui/ui.module.css'
import { agruparPorDia, quandoAconteceu } from '@/lib/regras'
import type { ActivityLog, Profile } from '@/types/database'
import styles from './dashboard.module.css'

/** Ícone e cor pelo que foi feito: criar, mover, editar, concluir ou otimizar. */
function tipoDaAcao(acao: string): { icone: NomeIcone; tom?: 'verde' | 'vermelho' } {
  if (/_(concluida|concluido|publicado)$/.test(acao)) return { icone: 'confirmar', tom: 'verde' }
  if (/_(criada|criado)$/.test(acao)) return { icone: 'mais', tom: 'vermelho' }
  if (/_(movida|movido)$/.test(acao)) return { icone: 'seta' }
  if (/_(editada|editado)$/.test(acao)) return { icone: 'editar' }
  if (acao.startsWith('otimizacao')) return { icone: 'campanhas', tom: 'verde' }
  return { icone: 'relogio' }
}

interface AtividadeProps {
  registros: ActivityLog[]
  perfilPorId: Map<string, Profile>
}

/** Registro de atividade agrupado por dia: o que foi feito, por quem e quando. */
export function Atividade({ registros, perfilPorId }: AtividadeProps) {
  return (
    <div className={styles.atividade}>
      {agruparPorDia(registros).map((grupo) => (
        <section key={grupo.dia} className={styles.atividadeGrupo} aria-label={grupo.rotulo}>
          <h3 className={styles.atividadeDia}>{grupo.rotulo}</h3>
          <ul className={`${ui.lista} stagger`}>
            {grupo.itens.map((registro) => {
              const autor = registro.user_id ? perfilPorId.get(registro.user_id) : undefined
              const tipo = tipoDaAcao(registro.acao)
              return (
                <li key={registro.id} className={ui.linha}>
                  <span className={styles.iconeAtividade} data-tom={tipo.tom}>
                    <Icone nome={tipo.icone} tamanho={15} />
                  </span>
                  <p className={ui.linhaTexto}>
                    <span>
                      <strong>{autor?.nome ?? 'Alguém'}</strong> {registro.descricao}
                    </span>
                    <span className={ui.mudo}>{quandoAconteceu(registro.created_at)}</span>
                  </p>
                  <Avatar nome={autor?.nome ?? null} url={autor?.avatar_url} tamanho={28} />
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
