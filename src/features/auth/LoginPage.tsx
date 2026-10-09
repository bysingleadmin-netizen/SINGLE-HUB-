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

export function LoginPage() {
  const { sessao, carregando } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!carregando && sessao) return <Navigate to="/app/dashboard" replace />

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) setErro(traduzirErroAuth(error.message))
      // Em caso de sucesso, o AuthProvider recebe a sessão e o redirect acima acontece.
    } catch (falha) {
      setErro(traduzirErroAuth(falha instanceof Error ? falha.message : undefined))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={styles.tela}>
      <form className={`${styles.cartao} fade-up`} onSubmit={entrar} noValidate>
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
          <Campo
            rotulo="Senha"
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
        </div>

        {erro && (
          <p role="alert" className={styles.erro}>
            {erro}
          </p>
        )}

        <Button type="submit" carregando={enviando} disabled={!email.trim() || !senha}>
          Entrar
        </Button>
      </form>
    </div>
  )
}
