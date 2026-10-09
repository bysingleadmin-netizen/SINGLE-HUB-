import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { EstadoErro } from '@/components/ui/Estado'
import { Icone } from '@/components/ui/Icone'
import { Painel } from '@/components/ui/Painel'
import { Pill } from '@/components/ui/Pill'
import { Selecao } from '@/components/ui/Selecao'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import ui from '@/components/ui/ui.module.css'
import { ACEITA_IMAGENS, enviarImagem, validarImagem } from '@/dados/arquivos'
import { useAtualizarOtimista, useSalvar } from '@/dados/base'
import { usePerfis } from '@/dados/tabelas'
import { useAuth } from '@/features/auth/AuthContext'
import { CARGOS, isLideranca } from '@/lib/permissoes'
import type { Cargo } from '@/lib/permissoes'
import type { Profile } from '@/types/database'
import styles from './configuracoes.module.css'

const OPCOES_CARGO = CARGOS.map((cargo) => ({ valor: cargo, rotulo: cargo }))

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

function Equipe({ eu }: { eu: Profile }) {
  const perfis = usePerfis()
  const atualizar = useAtualizarOtimista<Profile>('profiles')
  const toast = useToast()
  const podeEditar = isLideranca(eu.cargo)

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
    <Painel titulo="Equipe">
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
              {podeEditar && membro.id !== eu.id ? (
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
    </Painel>
  )
}

export function ConfiguracoesPage() {
  const { perfil } = useAuth()
  if (!perfil) return null

  return (
    <div className={styles.pagina}>
      <MeuPerfil perfil={perfil} />
      <Equipe eu={perfil} />
    </div>
  )
}
