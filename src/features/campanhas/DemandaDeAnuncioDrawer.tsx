import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from '@/components/quadro/detalhe.module.css'
import { useEdicaoInline } from '@/components/quadro/useEdicaoInline'
import { Campo } from '@/components/ui/Campo'
import { Drawer } from '@/components/ui/Drawer'
import { Icone } from '@/components/ui/Icone'
import { Selecao } from '@/components/ui/Selecao'
import ui from '@/components/ui/ui.module.css'
import type { ColunaDoQuadro } from '@/dados/colunas'
import { useColunasOpcionais } from '@/dados/esquema'
import { opcoesDePessoas } from '@/lib/pessoas'
import { FUNCOES_CAMPANHA } from '@/lib/rotulos'
import type { Campaign, CampaignFuncao, CampaignTask, Client, Profile } from '@/types/database'

interface Props {
  tarefa: CampaignTask
  campanhas: Campaign[]
  clientes: Client[]
  perfis: Profile[]
  colunas: readonly ColunaDoQuadro[]
  onFechar: () => void
}

/**
 * Painel de uma demanda de anúncio: cada campo salva sozinho. A campanha é opcional; sem ela, a
 * demanda guarda o próprio cliente.
 */
export function DemandaDeAnuncioDrawer({ tarefa, campanhas, clientes, perfis, colunas, onFechar }: Props) {
  const [titulo, setTitulo] = useState(tarefa.titulo)
  const [erroTitulo, setErroTitulo] = useState<string>()
  const esquema = useColunasOpcionais()
  const salvar = useEdicaoInline<CampaignTask>('campaign_tasks', tarefa.id, {
    sucesso: 'Demanda de anúncio atualizada.',
    erro: 'Não foi possível salvar a demanda de anúncio.',
  })
  const campanha = campanhas.find((c) => c.id === tarefa.campaign_id)

  function salvarTitulo() {
    const limpo = titulo.trim()
    if (limpo === '') {
      setErroTitulo('Informe o título da demanda.')
      setTitulo(tarefa.titulo)
      return
    }
    setErroTitulo(undefined)
    if (limpo !== tarefa.titulo) salvar({ titulo: limpo })
  }

  return (
    <Drawer aberto titulo={tarefa.titulo} onFechar={onFechar}>
      <div className={styles.detalhe}>
        <Campo
          className={styles.titulo}
          rotulo="Título"
          value={titulo}
          erro={erroTitulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          onBlur={salvarTitulo}
        />

        <section className={styles.bloco} aria-label="Detalhes">
          <h3 className={styles.blocoTitulo}>Detalhes</h3>
          <div className={styles.propriedades}>
            <Selecao
              rotulo="Status"
              opcoes={colunas.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))}
              value={tarefa.status}
              onChange={(evento) => salvar({ status: evento.target.value })}
            />
            <Selecao
              rotulo="Função"
              opcoes={FUNCOES_CAMPANHA}
              value={tarefa.funcao}
              onChange={(evento) => salvar({ funcao: evento.target.value as CampaignFuncao })}
            />
            <Selecao
              rotulo="Responsável"
              vazio="Sem responsável"
              opcoes={opcoesDePessoas(perfis)}
              value={tarefa.responsavel_id ?? ''}
              onChange={(evento) => salvar({ responsavel_id: evento.target.value || null })}
            />
            <Selecao
              rotulo="Campanha"
              vazio={esquema.demandaSemCampanha ? 'Sem campanha' : undefined}
              opcoes={campanhas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              value={tarefa.campaign_id ?? ''}
              onChange={(evento) => {
                const campanhaId = evento.target.value || null
                // Com campanha, o cliente vem dela; a demanda não guarda outro
                salvar(
                  esquema.demandaSemCampanha
                    ? { campaign_id: campanhaId, client_id: campanhaId ? null : (campanha?.client_id ?? null) }
                    : { campaign_id: campanhaId },
                )
              }}
            />
            {esquema.demandaSemCampanha && !tarefa.campaign_id && (
              <Selecao
                rotulo="Cliente"
                vazio="Sem cliente"
                opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
                value={tarefa.client_id ?? ''}
                onChange={(evento) => salvar({ client_id: evento.target.value || null })}
              />
            )}
          </div>
        </section>

        {campanha && (
          <Link to={`/app/anuncios/${campanha.id}`} className={ui.linkAcao}>
            Abrir a campanha {campanha.nome}
            <Icone nome="seta" tamanho={14} />
          </Link>
        )}
      </div>
    </Drawer>
  )
}
