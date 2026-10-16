// Edge Function: cria a conta de quem recebeu um convite.
//
// O cadastro público do Supabase fica desligado (Authentication > Sign In / Providers > "Allow
// new users to sign up" desmarcado): sem ele, a única porta para criar conta é esta função, que
// confere o código no servidor antes de criar. Antes, a tela conferia o código e depois pedia
// ao Supabase para criar a conta, e qualquer um podia pular a tela e pedir direto.
//
// Quem chama ainda não tem login, então a função não exige sessão: o que ela exige é um código
// válido, do mesmo e-mail, dentro do prazo e ainda não usado.
//
// Publicar: supabase functions deploy criar-conta --project-ref <ref do projeto>

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { responder, servir } from '../_shared/acesso.ts'

const RECUSA = 'Código inválido ou expirado. Peça um novo convite à liderança.'

servir('criar-conta', async (req) => {
  const url = Deno.env.get('SUPABASE_URL')
  const chaveDeServico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !chaveDeServico) {
    console.error('criar-conta: variáveis ausentes')
    return responder({ erro: 'O cadastro está sem configuração no servidor. Avise a liderança.' })
  }

  let corpo: { email?: unknown; codigo?: unknown; senha?: unknown } = {}
  try {
    corpo = await req.json()
  } catch {
    // corpo ausente ou inválido cai na validação abaixo
  }
  const email = String(corpo.email ?? '').trim().toLowerCase()
  const codigo = String(corpo.codigo ?? '').trim().toUpperCase()
  const senha = String(corpo.senha ?? '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return responder({ erro: 'Informe um e-mail válido.' })
  if (!/^[A-Z0-9]{6}$/.test(codigo)) return responder({ erro: RECUSA })
  if (senha.length < 6) return responder({ erro: 'A senha precisa ter pelo menos 6 caracteres.' })

  const admin = createClient(url, chaveDeServico, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: convite, error: erroConvite } = await admin
    .from('invite_codes')
    .select('id, cargo')
    .eq('email', email)
    .eq('code', codigo)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  if (erroConvite) throw erroConvite
  if (!convite) return responder({ erro: RECUSA })

  // O código é gasto antes de criar a conta: dois pedidos ao mesmo tempo com o mesmo código não
  // criam duas contas. Se a criação falhar, ele volta a valer.
  const { data: gasto, error: erroGasto } = await admin
    .from('invite_codes')
    .update({ used: true, used_at: new Date().toISOString() })
    .eq('id', convite.id)
    .eq('used', false)
    .select('id')
  if (erroGasto) throw erroGasto
  if (!gasto || gasto.length === 0) return responder({ erro: RECUSA })

  const devolverCodigo = () =>
    admin.from('invite_codes').update({ used: false, used_at: null }).eq('id', convite.id)

  const { data: criado, error: erroConta } = await admin.auth.admin.createUser({
    email,
    password: senha,
    // O código chegou por e-mail: o endereço já está confirmado
    email_confirm: true,
  })
  if (erroConta || !criado.user) {
    await devolverCodigo()
    console.error('criar-conta: createUser', erroConta?.status, erroConta?.message)
    if (erroConta && (erroConta.status === 422 || /already/i.test(erroConta.message))) {
      return responder({ erro: 'Este e-mail já tem conta. Use "Entrar".' })
    }
    if (erroConta && /password/i.test(erroConta.message)) {
      return responder({ erro: 'Senha fraca demais. Use uma senha mais longa, com letras e números.' })
    }
    return responder({ erro: 'Não foi possível criar a conta. Tente de novo.', detalhe: erroConta?.message })
  }

  // O perfil nasce Colaborador (gatilho do banco); aqui ganha o cargo do convite
  const { error: erroCargo } = await admin
    .from('profiles')
    .update({ cargo: convite.cargo })
    .eq('id', criado.user.id)
  if (erroCargo) {
    console.error('criar-conta: cargo', erroCargo.message)
    return responder({ ok: true, avisoCargo: true })
  }

  return responder({ ok: true })
})
