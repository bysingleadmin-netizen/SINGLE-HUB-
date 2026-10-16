// E-mails que o SINGLE OS manda pela API do Resend (convite e acesso revogado).
//
// Os modelos são funções puras, testadas em emails.test.ts. O envio fica em `enviarEmail`.
// Remetente: o domínio bysingle.com.br, já validado no Resend. EMAIL_REMETENTE em Edge Functions >
// Secrets troca o endereço; EMPRESA_NOME troca o nome da agência no assunto e no texto.

export const REMETENTE_PADRAO = 'SINGLE OS <noreply@bysingle.com.br>'
export const EMPRESA_PADRAO = 'SINGLE'
export const APP_PADRAO = 'https://singlehubos.vercel.app'

export interface Email {
  assunto: string
  /** Primeira linha que a caixa de entrada mostra ao lado do assunto */
  previa: string
  html: string
  texto: string
}

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const saudacao = (nome?: string | null) => (nome?.trim() ? `Olá, ${nome.trim()}` : 'Olá')

/**
 * Corpo comum: fundo claro (o escuro some em vários clientes de e-mail), a prévia escondida no
 * começo e um bloco por parágrafo.
 */
function montar(previa: string, blocos: string[]): string {
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SINGLE OS</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(previa)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<tr><td style="padding:28px 32px 0;font-size:13px;font-weight:700;letter-spacing:0.12em;color:#e63030;">SINGLE OS</td></tr>
<tr><td style="padding:12px 32px 32px;font-size:15px;line-height:1.6;">
${blocos.join('\n')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

interface DadosDoConvite {
  nome?: string | null
  cargo: string
  codigo: string
  empresa?: string
  app?: string
}

export function emailDeConvite({ nome, cargo, codigo, empresa = EMPRESA_PADRAO, app = APP_PADRAO }: DadosDoConvite): Email {
  const previa = `${saudacao(nome)}, você recebeu acesso ao sistema de gestão da ${empresa}. Use o código ${codigo} para criar sua conta.`
  const entrar = `${app}/login`
  return {
    assunto: `Você foi convidado para o SINGLE OS — ${empresa}`,
    previa,
    html: montar(previa, [
      `<p style="margin:0 0 16px;">${escapar(saudacao(nome))}, você recebeu acesso ao sistema de gestão da ${escapar(empresa)}, como <strong>${escapar(cargo)}</strong>.</p>`,
      `<p style="margin:0 0 8px;">Para criar sua conta, abra o SINGLE OS, escolha <strong>Criar conta</strong> e use este código:</p>`,
      `<p style="margin:16px 0;padding:18px;background:#f4f4f5;border-radius:8px;text-align:center;font-size:30px;font-weight:700;letter-spacing:10px;color:#e63030;">${escapar(codigo)}</p>`,
      `<p style="margin:0 0 24px;"><a href="${escapar(entrar)}" style="display:inline-block;padding:12px 20px;background:#e63030;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:700;">Abrir o SINGLE OS</a></p>`,
      `<p style="margin:0;font-size:13px;color:#71717a;">O código vale por 1 hora e só funciona com este e-mail. Não compartilhe.</p>`,
    ]),
    texto: [
      `${saudacao(nome)}, você recebeu acesso ao sistema de gestão da ${empresa}, como ${cargo}.`,
      '',
      `Para criar sua conta, abra ${entrar}, escolha "Criar conta" e use o código: ${codigo}`,
      '',
      'O código vale por 1 hora e só funciona com este e-mail. Não compartilhe.',
    ].join('\n'),
  }
}

interface DadosDaRevogacao {
  nome?: string | null
  empresa?: string
}

export function emailDeAcessoRevogado({ nome, empresa = EMPRESA_PADRAO }: DadosDaRevogacao): Email {
  const previa = `${saudacao(nome)}, seu acesso ao sistema de gestão da ${empresa} foi revogado.`
  return {
    assunto: `Seu acesso ao SINGLE OS foi revogado — ${empresa}`,
    previa,
    html: montar(previa, [
      `<p style="margin:0 0 16px;">${escapar(saudacao(nome))}, seu acesso ao SINGLE OS, o sistema de gestão da ${escapar(empresa)}, foi revogado pela liderança.</p>`,
      `<p style="margin:0 0 16px;">Sua conta foi removida e não é mais possível entrar com este e-mail.</p>`,
      `<p style="margin:0;font-size:13px;color:#71717a;">Se você acha que isso foi um engano, fale com a liderança da ${escapar(empresa)}.</p>`,
    ]),
    texto: [
      `${saudacao(nome)}, seu acesso ao SINGLE OS, o sistema de gestão da ${empresa}, foi revogado pela liderança.`,
      '',
      'Sua conta foi removida e não é mais possível entrar com este e-mail.',
      '',
      `Se você acha que isso foi um engano, fale com a liderança da ${empresa}.`,
    ].join('\n'),
  }
}

/** Manda pelo Resend. Lança erro com a resposta dele quando o envio é recusado. */
export async function enviarEmail(chave: string, remetente: string, para: string, email: Email): Promise<void> {
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remetente,
      to: [para],
      subject: email.assunto,
      html: email.html,
      text: email.texto,
    }),
  })
  if (!resposta.ok) {
    throw new Error(`O Resend recusou o e-mail (${resposta.status}): ${await resposta.text()}`)
  }
}
