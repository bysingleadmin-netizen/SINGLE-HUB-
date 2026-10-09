# Integrações do Sistema SINGLE

Estado de cada sistema externo e o que falta fazer. Atualize as caixas conforme for concluindo.

Última atualização: 2026-10-08

## Supabase (banco, login, arquivos)

- [x] Projeto criado
- [x] `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` cadastradas na Vercel
- [x] Arquivo `.env.local` preenchido (só necessário para rodar no seu computador; não vai para o GitHub)
- [x] Migration aplicada
- [x] Primeiro usuário criado e marcado como CEO

### Rodar no seu computador

1. Copie `.env.example` para `.env.local`.
2. Preencha as duas variáveis com os valores de Project Settings > API no painel do Supabase (os mesmos que estão na Vercel).
3. Rode `npm install` e depois `npm run dev`.

Sem essas variáveis o sistema abre a tela "Configuração pendente" em vez do login.

### Aplicar a migration

1. No painel do Supabase, abra SQL Editor.
2. Cole o conteúdo inteiro de `supabase/migrations/0001_schema.sql` e clique em Run.
3. Confira em Table Editor se as 11 tabelas apareceram e, em Storage, os buckets `logos` e `avatars`.

A migration deve ser rodada uma única vez, em um projeto ainda sem essas tabelas.

### Criar o primeiro usuário (CEO)

Não existe cadastro público. Cada pessoa da equipe é criada pelo painel.

1. Em Authentication > Users, clique em Add user > Create new user.
2. Informe e-mail e senha e marque Auto Confirm User.
3. O perfil é criado sozinho com o cargo "Social Media". Para transformar o primeiro usuário em CEO, rode no SQL Editor:

```sql
update public.profiles
set cargo = 'CEO', nome = 'Seu Nome'
where email = 'seu@email.com';
```

Depois disso, os cargos dos demais membros poderão ser ajustados pela tela Configurações (etapa 2). Até lá, use o mesmo comando trocando o cargo por um destes: `CEO`, `Founder`, `Co-Founder`, `Gestor de Tráfego`, `Social Media`, `Designer`, `Editor de Vídeo`, `Copywriter`.

### Convite de colaboradores (Edge Function)

O botão "Convidar colaborador", em Configurações > Equipe, chama a função `convidar-colaborador`. Ela existe porque o convite exige a chave de serviço do Supabase, que dá acesso total ao banco e não pode ficar no navegador.

- [ ] Função publicada. O código está em `supabase/functions/convidar-colaborador/index.ts`. Para publicar, com a CLI do Supabase logada na conta do SINGLE: `supabase functions deploy convidar-colaborador --project-ref <ref do projeto>`. Também dá para criar pelo painel, em Edge Functions > Deploy a new function, colando o conteúdo do arquivo
- [ ] Modelo do e-mail de convite revisado (Authentication > Emails > Invite user)

Enquanto a função não estiver publicada, o botão mostra o aviso "A função de convite ainda não foi publicada no Supabase".

### Tabelas da etapa 3

`calendar_events`, `event_participants` e `notifications` foram criadas direto no painel, fora de `supabase/migrations`. Confira:

- [ ] RLS ligado nas três, com leitura e escrita para usuários autenticados em `calendar_events` e `event_participants`
- [ ] Em `notifications`: cada pessoa lê e atualiza só as próprias linhas (`user_id = auth.uid()`), e qualquer autenticado pode inserir, porque quem cria uma tarefa avisa o responsável
- [ ] Se `tipo` tiver restrição de valores, ela aceita `reuniao`, `gravacao`, `entrega`, `otimizacao` e `outro` nos eventos, e `tarefa`, `evento` e `prazo` nas notificações

## GitHub (código)

- [x] Repositório criado
- [x] Código enviado para `main`

## Vercel (hospedagem)

O SINGLE fica na conta Vercel nova, ligada ao GitHub `bysingleadmin-netizen`. Ela publica sozinha a cada push em `main` do repositório `SINGLE-HUB-`.

- [x] Repositório `SINGLE-HUB-` conectado
- [x] Variáveis de ambiente cadastradas no projeto `singlehub.os` (https://singlehubos.vercel.app)
- [ ] Apagar os seis projetos duplicados criados a partir do mesmo repositório (`singlehub`, `single.os`, `singleos`, `singlehub1`, `single.system`, `single.system.hub`). Eles não têm as variáveis do Supabase e mostram "Configuração pendente". Em cada um: Settings > General > Delete Project
- [ ] Domínio próprio (opcional)

Para publicar, basta enviar o código para `main`. Não use `vercel deploy` neste computador: a CLI está logada na conta antiga (`saasownerbr`, onde ficam `usefindash` e `vyo.clin`), que não é do SINGLE.

- [ ] Decidir o destino do projeto `singlehub` da conta antiga (https://singlehub.vercel.app). Ele recebeu as publicações das etapas 1 e 2 por engano e continua no ar

Configuração esperada do projeto na Vercel: framework Vite, comando de build `npm run build`, pasta de saída `dist`. O arquivo `vercel.json` já redireciona todas as rotas para o app, então recarregar a página em `/app/clientes` funciona.

Variáveis `VITE_` são embutidas no momento do build. Se alterar alguma na Vercel, faça um novo deploy para valer.

## Resend (e-mail de redefinição de senha)

- [ ] Conta criada
- [ ] Domínio validado
- [ ] Configurado como SMTP no Supabase (Authentication > Emails > SMTP Settings)

Nenhuma parte do sistema depende do Resend hoje. Ele só passa a importar quando a tela "Esqueci minha senha" for adicionada. Enquanto isso, senhas são redefinidas pelo painel do Supabase em Authentication > Users.
