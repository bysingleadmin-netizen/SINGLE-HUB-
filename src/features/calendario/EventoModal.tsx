import { useState } from 'react'
import type { FormEvent } from 'react'
import { AreaTexto } from '@/components/ui/AreaTexto'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Modal } from '@/components/ui/Modal'
import { Selecao } from '@/components/ui/Selecao'
import { SeletorDePessoas } from '@/components/ui/SeletorDePessoas'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { useCriarEvento } from '@/dados/eventos'
import { useNotificar } from '@/dados/notificacoes'
import { useAuth } from '@/features/auth/AuthContext'
import { formatarData } from '@/lib/formato'
import type { Erros } from '@/lib/formulario'
import { TIPOS_EVENTO } from '@/lib/rotulos'
import type { Client, Profile, TipoEvento } from '@/types/database'
import { formNovoEvento, validarEvento } from './calendario'
import type { FormEvento } from './calendario'
import styles from './calendario.module.css'

interface EventoModalProps {
  /** Dia que já vem preenchido, 'AAAA-MM-DD' */
  dia: string
  clientes: Client[]
  perfis: Profile[]
  onFechar: () => void
}

export function EventoModal({ dia, clientes, perfis, onFechar }: EventoModalProps) {
  const { perfil } = useAuth()
  const [form, setForm] = useState<FormEvento>(() => formNovoEvento(dia))
  const [erros, setErros] = useState<Erros<FormEvento>>({})
  const criar = useCriarEvento()
  const notificar = useNotificar()
  const toast = useToast()

  function mudar<C extends keyof FormEvento>(campo: C, valor: FormEvento[C]) {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const resultado = validarEvento(form)
    if ('erros' in resultado) {
      setErros(resultado.erros)
      return
    }
    setErros({})
    criar.mutate(
      { valores: resultado.valores, participantes: form.participantes },
      {
        onSuccess: ({ evento: criado, participantesSalvos }) => {
          if (participantesSalvos) {
            toast.sucesso('Evento criado.')
            void notificar(form.participantes, {
              tipo: 'evento',
              titulo: 'Novo evento na agenda',
              mensagem: `${perfil?.nome ?? 'Alguém'} incluiu você em "${criado.titulo}", em ${formatarData(form.data_inicio)}.`,
              link: `/app/calendario?dia=${form.data_inicio}`,
            })
          } else {
            toast.erro('O evento foi criado, mas não foi possível salvar os participantes.')
          }
          onFechar()
        },
        onError: () => toast.erro('Não foi possível criar o evento.'),
      },
    )
  }

  return (
    <Modal aberto titulo="Novo evento" onFechar={onFechar}>
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
            rotulo="Tipo"
            opcoes={TIPOS_EVENTO}
            value={form.tipo}
            onChange={(evento) => mudar('tipo', evento.target.value as TipoEvento)}
          />
          <Campo
            rotulo="Data"
            type="date"
            value={form.data_inicio}
            erro={erros.data_inicio}
            onChange={(evento) => mudar('data_inicio', evento.target.value)}
          />
        </div>

        <label className={styles.marcar}>
          <input
            type="checkbox"
            checked={form.dia_inteiro}
            onChange={(evento) => mudar('dia_inteiro', evento.target.checked)}
          />
          Dia inteiro
        </label>

        {form.dia_inteiro ? (
          <Campo
            rotulo="Até"
            type="date"
            min={form.data_inicio}
            value={form.data_fim}
            erro={erros.data_fim}
            onChange={(evento) => mudar('data_fim', evento.target.value)}
          />
        ) : (
          <div className={ui.duasColunas}>
            <Campo
              rotulo="Início"
              type="time"
              value={form.hora_inicio}
              erro={erros.hora_inicio}
              onChange={(evento) => mudar('hora_inicio', evento.target.value)}
            />
            <Campo
              rotulo="Fim"
              type="time"
              value={form.hora_fim}
              erro={erros.hora_fim}
              onChange={(evento) => mudar('hora_fim', evento.target.value)}
            />
          </div>
        )}

        <Selecao
          rotulo="Cliente"
          vazio="Sem cliente"
          opcoes={clientes.map((c) => ({ valor: c.id, rotulo: c.nome }))}
          value={form.client_id}
          onChange={(evento) => mudar('client_id', evento.target.value)}
        />
        <SeletorDePessoas
          rotulo="Participantes"
          pessoas={perfis}
          escolhidas={form.participantes}
          onMudar={(ids) => mudar('participantes', ids)}
        />
        <AreaTexto
          rotulo="Descrição"
          rows={3}
          value={form.descricao}
          onChange={(evento) => mudar('descricao', evento.target.value)}
        />
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={criar.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
