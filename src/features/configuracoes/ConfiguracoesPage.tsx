import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Abas } from '@/components/ui/Abas'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { EstadoErro } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Modal } from '@/components/ui/Modal'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { ACEITA_IMAGENS, enviarImagem, validarImagem } from '@/dados/arquivos'
import { useAtualizarOtimista, useSalvar } from '@/dados/base'
import { useConvidar } from '@/dados/convite'
import { usePerfis } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { emailValido } from '@/lib/formulario'
import { CARGOS, isLideranca } from '@/lib/permissoes'
import type { Cargo } from '@/lib/permissoes'
import type { Profile } from '@/types/database'
import styles from './configuracoes.module.css'

const OPCOES_CARGO = CARGOS.map((cargo) => ({ valor: cargo, rotulo: cargo }))

const ABAS = [
  { id: 'perfil', rotulo: 'Meu perfil' },
  { id: 'equipe', rotulo: 'Equipe' },
] as const

type Aba = (typeof ABAS)[number]['id']

function MeuPerfil({ perfil }: { perfil: Profile }) {
  const [nome, setNome] = useState(perfil.nome)
  const [erro, setErro] = useState<string>()
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const salvar = useSalvar<Profile>('profiles')
  const queryClient = useQueryClient()
  const toast = useToast()

  // A sidebar lê o perfil da sessão, que tem cache próprio
  const atualizarSessao = () => queryClient.invalidateQueries({ queryKey: ['perfil'] })

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = nome.trim()
    if (limpo === '') {
      setErro('Informe seu nome.')
      return
    }
    setErro(undefined)
    salvar.mutate(
      { id: perfil.id, valores: { nome: limpo } },
      {
        onSuccess: () => {
          toast.sucesso('Perfil atualizado.')
          void atualizarSessao()
        },
        onError: () => toast.erro('Não foi possível salvar o perfil.'),
      },
    )
  }

  async function aoEscolherFoto(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    const recusa = validarImagem(arquivo)
    if (recusa) {
      toast.erro(recusa)
      return
    }
    setEnviandoFoto(true)
    try {
      // O banco só aceita avatar dentro da pasta com o id do próprio usuário
      const avatar_url = await enviarImagem('avatars', perfil.id, arquivo)
      await salvar.mutateAsync({ id: perfil.id, valores: { avatar_url } })
      toast.sucesso('Foto atualizada.')
      void atualizarSessao()
    } catch {
      toast.erro('Não foi possível enviar a foto.')
    } finally {
      setEnviandoFoto(false)
    }
  }

  return (
    <Painel titulo="Meu perfil">
      <div className={styles.identidade}>
        <Avatar nome={perfil.nome} url={perfil.avatar_url} tamanho={72} />
        <div className={styles.identidadeTexto}>
          <span className={ui.mudo}>{perfil.email}</span>
          <Pill tom="cinza">{perfil.cargo}</Pill>
        </div>
        <label className={styles.enviar} aria-busy={enviandoFoto || undefined}>
          <Icone nome="enviar" tamanho={16} />
          Enviar foto
          <input
            type="file"
            accept={ACEITA_IMAGENS}
            className={ui.somenteLeitor}
            disabled={enviandoFoto}
            onChange={(evento) => void aoEscolherFoto(evento)}
          />
        </label>
      </div>
      <form className={styles.formulario} onSubmit={aoEnviar} noValidate>
        <Campo
          rotulo="Nome"
          value={nome}
          erro={erro}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <Button type="submit" carregando={salvar.isPending && !enviandoFoto}>
          Salvar
        </Button>
      </form>
    </Painel>
  )
}

function ConviteModal({ onFechar }: { onFechar: () => void }) {
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState<Cargo>('Social Media')
  const [erroEmail, setErroEmail] = useState<string>()
  const convidar = useConvidar()
  const toast = useToast()

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    const limpo = email.trim()
    if (!emailValido(limpo)) {
      setErroEmail('Informe um e-mail válido.')
      return
    }
    setErroEmail(undefined)
    convidar.mutate({ email: limpo, cargo }, {
      onSuccess: () => {
        toast.sucesso(`Convite enviado para ${limpo}.`)
        onFechar()
      },
      onError: (falha) => toast.erro(falha.message),
    })
  }

  return (
    <Modal aberto titulo="Convidar colaborador" onFechar={onFechar}>
      <form className={ui.formulario} onSubmit={aoEnviar} noValidate>
        <p className={ui.mudo}>
          A pessoa receberá um código de 6 dígitos por e-mail para criar a conta. O código expira em 1 hora.
        </p>
        <Campo
          rotulo="E-mail"
          type="email"
          autoFocus
          value={email}
          erro={erroEmail}
          onChange={(evento) => setEmail(evento.target.value)}
        />
        <Selecao
          rotulo="Cargo"
          opcoes={OPCOES_CARGO}
          value={cargo}
          onChange={(evento) => setCargo(evento.target.value as Cargo)}
        />
        <div className={ui.acoes}>
          <Button variante="fantasma" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" carregando={convidar.isPending}>
            Enviar convite
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Só é montada para a liderança. */
function Equipe({ eu }: { eu: Profile }) {
  const perfis = usePerfis()
  const atualizar = useAtualizarOtimista<Profile>('profiles')
  const toast = useToast()
  const [convidando, setConvidando] = useState(false)

  function trocarCargo(id: string, cargo: Cargo) {
    atualizar.mutate(
      { id, valores: { cargo } },
      {
        onSuccess: () => toast.sucesso('Cargo atualizado.'),
        onError: () => toast.erro('Não foi possível atualizar o cargo.'),
      },
    )
  }

  return (
    <Painel
      titulo="Equipe"
      acao={
        <Button className={ui.botaoPequeno} onClick={() => setConvidando(true)}>
          <Icone nome="mais" tamanho={14} />
          Convidar colaborador
        </Button>
      }
    >
      {perfis.isError ? (
        <EstadoErro onTentar={() => void perfis.refetch()} />
      ) : perfis.isLoading ? (
        <Skeleton altura="56px" />
      ) : (
        <ul className={`${ui.lista} stagger`}>
          {(perfis.data ?? []).map((membro) => (
            <li key={membro.id} className={ui.linha}>
              <Avatar nome={membro.nome} url={membro.avatar_url} tamanho={36} />
              <div className={ui.linhaTexto}>
                <span className={ui.linhaTitulo}>{membro.nome}</span>
                <span className={ui.mudo}>{membro.email}</span>
              </div>
              {/* Ninguém muda o próprio cargo, para a equipe nunca ficar sem liderança por engano */}
              {membro.id !== eu.id ? (
                <Selecao
                  className={styles.cargo}
                  rotulo={`Cargo de ${membro.nome}`}
                  ocultarRotulo
                  opcoes={OPCOES_CARGO}
                  value={membro.cargo}
                  onChange={(evento) => trocarCargo(membro.id, evento.target.value as Cargo)}
                />
              ) : (
                <Pill tom="cinza">{membro.cargo}</Pill>
              )}
            </li>
          ))}
        </ul>
      )}
      {convidando && <ConviteModal onFechar={() => setConvidando(false)} />}
    </Painel>
  )
}

export function ConfiguracoesPage() {
  const { perfil } = useAuth()
  const [aba, setAba] = useState<Aba>('perfil')
  if (!perfil) return null

  // Sem liderança não há aba Equipe, então também não há por que mostrar abas
  if (!isLideranca(perfil.cargo)) {
    return (
      <div className={styles.pagina}>
        <MeuPerfil perfil={perfil} />
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <Abas rotulo="Seções de configurações" abas={ABAS} ativa={aba} onMudar={setAba}>
        {aba === 'perfil' ? <MeuPerfil perfil={perfil} /> : <Equipe eu={perfil} />}
      </Abas>
    </div>
  )
}
