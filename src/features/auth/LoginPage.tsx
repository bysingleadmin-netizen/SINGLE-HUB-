import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Campo } from '@/components/ui/Campo'
import { Logotipo } from '@/components/ui/Logotipo'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'
import { traduzirErroAuth } from './erros'
import styles from './auth.module.css'

type Modo = 'entrar' | 'cadastrar'

export function LoginPage() {
  const { sessao, carregando } = useAuth()
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!carregando && sessao) return <Navigate to="/app/dashboard" replace />

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })
      if (error) setErro(traduzirErroAuth(error.message))
    } catch (falha) {
      setErro(traduzirErroAuth(falha instanceof Error ? falha.message : undefined))
    } finally {
      setEnviando(false)
    }
  }

  async function cadastrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (senha !== senhaConfirm) {
      setErro('As senhas não coincidem.')
      return
    }
    setEnviando(true)
    try {
      const res = await supabase
        .from('invite_codes')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('code', codigo.trim().toUpperCase())
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .single()

      if (res.error || !res.data) {
        setErro('Código inválido ou expirado. Peça um novo convite ao CEO.')
        return
      }

      const convite = res.data

      const auth = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
      })

      if (auth.error || !auth.data.user) {
        setErro(traduzirErroAuth(auth.error?.message))
        return
      }

      await supabase
        .from('invite_codes')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', convite.id)

      await supabase
        .from('profiles')
        .update({ cargo: convite.cargo })
        .eq('id', auth.data.user.id)

    } catch (falha) {
      setErro(traduzirErroAuth(falha instanceof Error ? falha.message : undefined))
    } finally {
      setEnviando(false)
    }
  }

  function alternarModo() {
    setModo(modo === 'entrar' ? 'cadastrar' : 'entrar')
    setErro(null)
    setEmail('')
    setSenha('')
    setCodigo('')
    setSenhaConfirm('')
  }

  return (
    <div className={styles.tela}>
      <form
        className={`${styles.cartao} fade-up`}
        onSubmit={modo === 'entrar' ? entrar : cadastrar}
        noValidate
      >
        <div className={styles.marca}>
          <Logotipo altura={22} />
          <span className={styles.marcaSub}>Gestão da agência</span>
        </div>

        <div className={styles.campos}>
          <Campo
            rotulo="E-mail"
            type="email"
            autoComplete="email"
            placeholder="voce@single.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {modo === 'cadastrar' && (
            <Campo
              rotulo="Código de convite"
              type="text"
              placeholder="Ex: A3B7KX"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              maxLength={6}
              required
            />
          )}
          <Campo
            rotulo="Senha"
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          {modo === 'cadastrar' && (
            <Campo
              rotulo="Confirmar senha"
              type="password"
              autoComplete="new-password"
              value={senhaConfirm}
              onChange={(e) => setSenhaConfirm(e.target.value)}
              required
            />
          )}
        </div>

        {erro && (
          <p role="alert" className={styles.erro}>
            {erro}
          </p>
        )}

        <Button
          type="submit"
          carregando={enviando}
          disabled={
            !email.trim() ||
            !senha ||
            (modo === 'cadastrar' && (!codigo.trim() || !senhaConfirm))
          }
        >
          {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </Button>

        <button type="button" className={styles.alternar} onClick={alternarModo}>
          {modo === 'entrar' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta. Entrar'}
        </button>
      </form>
    </div>
  )
}