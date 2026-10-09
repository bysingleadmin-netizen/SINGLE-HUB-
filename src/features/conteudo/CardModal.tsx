import { useState } from 'react'
import type { FormEvent } from 'react'
import { proximaPosicao } from '@/components/quadro/colunas'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useRegistrarAtividade } from '@/dados/atividade'
import { useSalvar } from '@/dados/base'
import type { Erros } from '@/lib/formulario'
import { COLUNAS_CONTEUDO, TIPOS_CONTEUDO } from '@/lib/rotulos'
import type { Client, ContentCard, ContentEtapa, Profile, TipoConteudo } from '@/types/database'
import { formNovoCard, validarCard } from './card'
import type { FormCard } from './card'

const OPCOES_ETAPA = COLUNAS_CONTEUDO.map((coluna) => ({ valor: coluna.id, rotulo: coluna.titulo }))

interface CardModalProps {
  /** Etapa em que o conteúdo nasce */
  etapaInicial: ContentEtapa
  cards: ContentCard[]
  clientes: Client[]
  perfis: Profile[]
  onFechar: () => void
}

/** Cria um conteúdo. Para editar um que já existe, o quadro abre o CardDrawer. */
export function CardModal({ etapaInicial, cards, clientes, perfis, onFechar }: CardModalProps) {
  const [form, setForm] = useState<FormCard>(() => formNovoCard(etapaInicial))
  const [erros, setErros] = useState<Erros<FormCard>>({})
  const salvar = useSalvar<ContentCard>('content_cards')
  const registrarAtividade = useRegistrarAtividade()
  const toast = useToast()

  function mudar<C extends keyof FormCard>(campo: C, valor: FormCard[C]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarCard(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    setErros({})
    const { valores } = resultado
    // O conteúdo novo entra no fim da etapa
    const posicao = proximaPosicao(cards.filter((c) => c.etapa === valores.etapa))

    salvar.mutate(
      { valores: { ...valores, posicao } },
      {
        onSuccess: (salvo) => {
          toast.sucesso('Conteúdo criado.')
          void registrarAtividade({
            acao: 'conteudo_criado',
            descricao: `criou o conteúdo "${salvo.titulo}"`,
            entidade: 'content_cards',
            entidadeId: salvo.id,
          })
          onFechar()
        },
        onError: () => toast.erro('Não foi possível salvar o conteúdo.'),
      },
    )
  }

  return (
    <Modal aberto titulo="Novo conteúdo" onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <Campo
          rotulo="Título"
          autoFocus
          value={form.titulo}
          erro={erros.titulo}
          onChange={(evento) => mudar('titulo', evento.target.value)}
        />
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Tipo de conteúdo"
            opcoes={TIPOS_CONTEUDO}
            value={form.tipo_conteudo}
            onChange={(evento) => mudar('tipo_conteudo', evento.target.value as TipoConteudo)}
          />
          <Selecao
            rotulo="Etapa"
            opcoes={OPCOES_ETAPA}
            value={form.etapa}
            onChange={(evento) => mudar('etapa', evento.target.value as ContentEtapa)}
          />
        </div>
        <div className={ui.duasColunas}>
          <Selecao
            rotulo="Cliente"
            vazio="Sem cliente"
            opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            value={form.client_id}
            onChange={(evento) => mudar('client_id', evento.target.value)}
          />
          <Selecao
            rotulo="Responsável"
            vazio="Sem responsável"
            opcoes={perfis.map((p) => ({ valor: p.id, rotulo: p.nome }))}
            value={form.responsavel_id}
            onChange={(evento) => mudar('responsavel_id', evento.target.value)}
          />
        </div>
        <Campo
          rotulo="Data de entrega"
          type="date"
          value={form.data_entrega}
          onChange={(evento) => mudar('data_entrega', evento.target.value)}
        />
        <AreaTexto
          rotulo="Observações"
          rows={3}
          value={form.observacoes}
          onChange={(evento) => mudar('observacoes', evento.target.value)}
        />
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={salvar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
