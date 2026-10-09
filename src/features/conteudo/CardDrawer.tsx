import { useState } from 'react'
import { Anexos } from '@/components/quadro/Anexos'
import styles from '@/components/quadro/detalhe.module.css'
import { useEdicaoInline } from '@/components/quadro/useEdicaoInline'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Campo } from '@/components/ui/Campo'
import { Drawer } from '@/components/ui/Drawer'
import { Icone } from '@/components/ui/Icone'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import type { ColunaDoQuadro } from '@/dados/colunas'
import { useColunasOpcionais } from '@/dados/esquema'
import { hojeISO } from '@/lib/datas'
import { formatarData } from '@/lib/formato'
import { textoOuNull } from '@/lib/formulario'
import { opcoesDePessoas } from '@/lib/pessoas'
import { cardAberto, descreverPrazo, situacaoDoPrazo } from '@/lib/regras'
import { PRIORIDADES, TIPOS_CONTEUDO, opcao } from '@/lib/rotulos'
import type {
  CardAttachment,
  Client,
  ContentCard,
  ContentEtapa,
  Prioridade,
  Profile,
  TipoConteudo,
} from '@/types/database'

interface CardDrawerProps {
  card: ContentCard
  clientes: Client[]
  perfis: Profile[]
  /** Etapas do quadro, com os nomes que a equipe deu */
  colunas: readonly ColunaDoQuadro[]
  /** undefined quando o banco ainda não tem a tabela de anexos */
  anexos?: CardAttachment[]
  /** Trocar a etapa é mover o card: quem sabe a posição e registra a atividade é a página */
  onMover: (destino: ContentEtapa) => void
  onFechar: () => void
}

/** Painel lateral do conteúdo. Cada campo salva sozinho: textos ao sair, seleções ao escolher. */
export function CardDrawer({
  card,
  clientes,
  perfis,
  colunas,
  anexos,
  onMover,
  onFechar,
}: CardDrawerProps) {
  const [titulo, setTitulo] = useState(card.titulo)
  const [observacoes, setObservacoes] = useState(card.observacoes ?? '')
  const [erroTitulo, setErroTitulo] = useState<string>()
  const esquema = useColunasOpcionais()
  const salvar = useEdicaoInline<ContentCard>('content_cards', card.id, {
    sucesso: 'Conteúdo atualizado.',
    erro: 'Não foi possível salvar o conteúdo.',
    atividade: {
      acao: 'conteudo_editado',
      descricao: `editou o conteúdo "${card.titulo}"`,
      entidade: 'content_cards',
      entidadeId: card.id,
    },
  })

  const hoje = hojeISO()
  const entregue = !cardAberto(card)
  const tipo = opcao(TIPOS_CONTEUDO, card.tipo_conteudo)
  const prioridade = opcao(PRIORIDADES, card.prioridade ?? 'media')

  function salvarTitulo() {
    const limpo = titulo.trim()
    if (limpo === '') {
      setErroTitulo('Informe o título do conteúdo.')
      setTitulo(card.titulo)
      return
    }
    setErroTitulo(undefined)
    if (limpo !== card.titulo) salvar({ titulo: limpo })
  }

  function salvarObservacoes() {
    const novas = textoOuNull(observacoes)
    if (novas !== (card.observacoes ?? null)) salvar({ observacoes: novas })
  }

  return (
    <Drawer aberto titulo={card.titulo} onFechar={onFechar}>
      <div className={styles.detalhe}>
        <div className={styles.resumo}>
          <Pill tom={tipo.tom}>{tipo.rotulo}</Pill>
          {esquema.prioridadeConteudo && (
            <Pill tom={prioridade.tom}>Prioridade {prioridade.rotulo}</Pill>
          )}
          <span
            className={styles.prazo}
            data-prazo={situacaoDoPrazo(card.data_entrega, hoje, entregue) ?? undefined}
          >
            <Icone nome="calendario" tamanho={14} />
            {descreverPrazo(card.data_entrega, hoje, entregue)}
          </span>
        </div>

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
              rotulo="Etapa"
              opcoes={colunas.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))}
              value={card.etapa}
              onChange={(evento) => onMover(evento.target.value as ContentEtapa)}
            />
            <Selecao
              rotulo="Tipo de conteúdo"
              opcoes={TIPOS_CONTEUDO}
              value={card.tipo_conteudo}
              onChange={(evento) => salvar({ tipo_conteudo: evento.target.value as TipoConteudo })}
            />
            <Selecao
              rotulo="Cliente"
              vazio="Sem cliente"
              opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
              value={card.client_id ?? ''}
              onChange={(evento) => salvar({ client_id: evento.target.value || null })}
            />
            <Selecao
              rotulo="Responsável"
              vazio="Sem responsável"
              opcoes={opcoesDePessoas(perfis)}
              value={card.responsavel_id ?? ''}
              onChange={(evento) => salvar({ responsavel_id: evento.target.value || null })}
            />
            <Campo
              rotulo="Data de entrega"
              type="date"
              value={card.data_entrega ?? ''}
              onChange={(evento) => salvar({ data_entrega: evento.target.value || null })}
            />
            {esquema.prioridadeConteudo && (
              <Selecao
                rotulo="Prioridade"
                opcoes={PRIORIDADES}
                value={card.prioridade ?? 'media'}
                onChange={(evento) => salvar({ prioridade: evento.target.value as Prioridade })}
              />
            )}
          </div>
        </section>

        <section className={styles.bloco} aria-label="Observações do conteúdo">
          <AreaTexto
            rotulo="Observações"
            placeholder="Salva ao sair do campo."
            value={observacoes}
            onChange={(evento) => setObservacoes(evento.target.value)}
            onBlur={salvarObservacoes}
          />
        </section>

        {anexos && (
          <section className={styles.bloco} aria-label="Anexos">
            <h3 className={styles.blocoTitulo}>Anexos</h3>
            <Anexos quadro="conteudo" cardId={card.id} anexos={anexos} />
          </section>
        )}

        <p className={styles.rodape}>Criado em {formatarData(card.created_at)}</p>
      </div>
    </Drawer>
  )
}
