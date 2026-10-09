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
      const { data: convite, error: erroConvite } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('code', codigo.trim().toUpperCase())
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .single()

      if (erroConvite || !convite) {
        setErro('Código inválido ou expirado. Peça um novo convite ao CEO.')
        return
      }

      const { data: authData, error: erroAuth } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
      })

      if (erroAuth || !authData.user) {
        setErro(traduzirErroAuth(erroAuth?.message))
        return
      }

      await supabase
        .from('invite_codes')
        .update({ used: true, used_at: new Date().toISOString()