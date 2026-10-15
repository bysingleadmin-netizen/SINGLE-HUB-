# Integrações do Sistema SINGLE

Estado de cada sistema externo e o que falta fazer. Atualize as caixas conforme for concluindo.

Última atualização: 2026-10-09

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

- [ ] Função publicada com o nome exato `convidar-colaborador`. Em 2026-10-09 o projeto do Supabase que o app usa respondia "Requested function was not found" para esse nome: ou a função não foi publicada neste projeto, ou foi publicada com outro nome. O código está em `supabase/functions/convidar-colaborador/index.ts`. Para publicar, com a CLI do Supabase logada na conta do SINGLE: `supabase functions deploy convidar-colaborador --project-ref <ref do projeto>`. Também dá para criar pelo painel, em Edge Functions > Deploy a new function: o nome da função precisa ser `convidar-colaborador` e o conteúdo é o do arquivo
- [ ] Conferir em Edge Functions > Secrets que existem `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. O Supabase costuma criar as três sozinho; se alguma faltar, a função responde dizendo qual
- [ ] Modelo do e-mail de convite revisado (Authentication > Emails > Invite user)

O botão sempre mostra o motivo da falha: função inexistente, variável ausente, limite de e-mails do Supabase atingido ou e-mail que já tem acesso. O limite de e-mails do Supabase sem SMTP próprio é baixo; se os convites passarem a falhar por isso, configure o Resend (fim deste arquivo).

### Migration 0003 (revisão de 2026-10-09)

- [ ] Rodar `supabase/migrations/0003_revisao.sql` inteiro no SQL Editor
- [ ] Conferir no aviso do SQL Editor se apareceu "pg_cron indisponível". Se apareceu, ligar a extensão em Database > Extensions > pg_cron e rodar a migration de novo; sem ela os cards arquivados nunca são excluídos

**Atenção:** a rotina diária exclui de vez os cards arquivados há mais de 30 dias, com subtarefas, anexos e comentários. Cards que já estavam concluídos ou arquivados antes da migration começam a contar no dia em que ela roda.

Ela inclui o que estava na 0002, então quem não rodou a 0002 só precisa desta. Pode rodar mais de uma vez. Foi testada em um Postgres local com o schema da 0001 e as tabelas criadas pelo painel.

O que ela faz e o que o app faz enquanto ela não roda:

| Recurso | Sem a migration | Com a migration |
|---|---|---|
| Dia do vencimento do cliente | vence no dia do mês em que o contrato começou | campo "Dia do vencimento" no cadastro |
| Forma de pagamento | o pagamento é confirmado, mas não fica gravado se foi Pix ou dinheiro | forma gravada e mostrada no histórico |
| Cobrança de cliente pausado ou em churn | as cobranças em aberto são apagadas | ficam com status "cancelado" |
| Prioridade | funciona nas demandas, com os valores que já estiverem no banco | padronizada (baixa, média, alta, urgente) em demandas e conteúdos |
| Colunas dos quadros | fixas | renomear com dois cliques, criar, remover e reordenar arrastando |
| Status do card | só "Feito" funciona (move o card para a coluna seguinte) | Travado, Em andamento e Feito, com selo colorido no card |
| Anexos do card | não aparecem | link ou imagem por card, com miniaturas no rodapé; imagens no bucket `anexos` do Storage |
| Opções configuráveis (status, prioridade, tipo de conteúdo) | listas fixas, sem a engrenagem | engrenagem ao lado de cada campo para renomear, criar e remover opções; salvas na tabela `card_options` |
| Subtarefas | a seção não aparece | seção "Tarefas" no painel do card, com caixa de marcar; tabela `card_subtarefas` |
| Arquivo automático | "Mostrar arquivados" mostra só o que foi arquivado à mão | card concluído fica 7 dias no quadro e vai para Arquivados; 30 dias depois é excluído pela rotina diária `limpar_cards` (pg_cron, 03:00 UTC) |
| Tempo real no Dashboard | a rosca de status atualiza ao voltar para a aba | a rosca muda assim que alguém altera um card (tabelas na publicação `supabase_realtime`) |
| RLS e índices | como estiverem no painel | RLS ligado em todas as tabelas, políticas das tabelas criadas pelo painel e índices nas colunas de filtro |

Tabelas criadas direto no painel, fora de `supabase/migrations`, que a 0003 passa a cobrir: `calendar_events`, `event_participants`, `notifications`, `task_comments` e a coluna `tasks.prioridade`. Nenhuma tem restrição de `tipo` garantida: o app grava `reuniao`, `gravacao`, `entrega`, `otimizacao` e `outro` nos eventos, e `tarefa`, `evento` e `prazo` nas notificações.

### Migration 0004 (Etapa 8, 2026-10-14)

- [ ] Rodar `supabase/migrations/0004_etapa8.sql` inteiro no SQL Editor (depois da 0003)

Pode rodar mais de uma vez. Foi testada em um Postgres local com o schema da 0001, a 0003 e as tabelas criadas pelo painel.

O que ela faz e o que o app faz enquanto ela não roda:

| Recurso | Sem a migration | Com a migration |
|---|---|---|
| Duração do contrato | o campo não aparece no cadastro do cliente | "Duração do contrato" (3, 6, 12 ou 15 meses, ou sem fidelidade) no cadastro, gravada em `clients.contrato_meses` |
| Editar cobrança e pagamento parcial | a cobrança só é confirmada inteira, sem botão de editar | botão de editar na cobrança, com valor pago, data do recebimento, observação e valor manual; selo Pago, Parcial ou Pendente. Um recebimento parcial seguido da quitação em outro mês conta tudo no mês da quitação: a cobrança guarda um valor pago e uma data |
| Cores dos status | cada opção usa a cor padrão | seletor de cor na engrenagem; a cor vale nos selos e na rosca do Dashboard (`card_options.cor`) |
| Quadro de Tarefas | o menu Tarefas avisa que o quadro liga depois desta migration | quadro de trabalho interno, separado de Demandas, na mesma tabela `tasks` (coluna `quadro`); tarefa interna não tem área |
| Quadro de Anúncios | as tarefas de anúncio aparecem só em lista | quadro com colunas próprias (renomear, criar e reordenar), em `campaign_tasks.posicao`; as campanhas ficam na aba Campanhas |
| CRM | o menu CRM avisa que liga depois desta migration | pipeline Leads, Reunião e Fechamento de contrato; soltar em Cliente pede MRR, duração e início e cria o cliente pela função `converter_lead`, numa operação só. Tabelas `leads` e `lead_historico`, só para a liderança (RLS) |
| Indicadores comerciais no Dashboard | MRR e ARR aparecem; leads no pipeline e conversão mostram um traço | MRR, ARR, leads no pipeline e conversão em 30 dias, só para a liderança, atualizando em tempo real (`clients` e `leads` na publicação `supabase_realtime`) |

### Migration 0005 (despesas recorrentes, 2026-10-15)

- [ ] Rodar `supabase/migrations/0005_recorrencia.sql` no SQL Editor (depois da 0004)

Pode rodar mais de uma vez. Acrescenta `recorrente` e `grupo_recorrencia` em `expenses`.

| Recurso | Sem a migration | Com a migration |
|---|---|---|
| Despesa recorrente | lança uma despesa por mês do mesmo jeito, mas sem marcar que elas são do mesmo lançamento | as despesas de um lançamento ficam marcadas com o mesmo `grupo_recorrencia`, para editar ou excluir o grupo no futuro |

### Pagamentos recorrentes

Ninguém cadastra pagamento à mão. Para cada cliente ativo com valor mensal e dia de vencimento, o sistema grava em `client_payments` a cobrança do mês atual e as dos três meses seguintes. Meses anteriores ao atual não são criados depois do fato.

Quem gera e ajusta as cobranças é o próprio app, no navegador de alguém da liderança (só a liderança pode gravar pagamentos). Basta uma pessoa da liderança abrir o sistema para o mês novo ganhar suas cobranças. Não há tarefa agendada no servidor.

## Asaas (cobranças pelo webhook)

O Asaas avisa o sistema a cada cobrança criada, paga, vencida, estornada ou excluída. A Edge
Function `asaas-webhook` grava cada uma em `receitas_asaas` e tenta achar o cliente: primeiro
pelo id do cliente do Asaas já ligado; senão, pelas duas primeiras palavras do nome, só quando um
único cliente casar. O que não for achado aparece em Financeiro > Cobranças Asaas com o botão
"Vincular cliente".

- [ ] Rodar `supabase/migrations/0006_asaas.sql` no SQL Editor (depois da 0005)
- [ ] Em Edge Functions > Secrets, cadastrar `ASAAS_WEBHOOK_TOKEN` com o token de autenticação do webhook (o mesmo que vai no Asaas). `ASAAS_API_KEY` ainda não é usada: fica para a sincronização manual.
- [ ] Publicar a função, sem verificação de JWT (o Asaas não tem login no Supabase; quem protege a função é o token):
  `supabase functions deploy asaas-webhook --no-verify-jwt --project-ref <ref do projeto>`
- [ ] No Asaas, em Integrações > Webhooks, criar um webhook com a URL
  `https://<ref do projeto>.supabase.co/functions/v1/asaas-webhook`, o mesmo token em "Token de
  autenticação" e os eventos de cobrança marcados

Como a função responde:

| Situação | Resposta |
|---|---|
| Token ausente ou diferente de `ASAAS_WEBHOOK_TOKEN` | 401, e nada é gravado |
| Evento de cobrança (`PAYMENT_*`) | grava ou atualiza a cobrança pelo id dela e responde 200 |
| Outros eventos (assinatura, conta) | ignorados, 200 |
| Falha ao gravar | vai para o log da função (Edge Functions > asaas-webhook > Logs) e responde 200 |

A resposta é 200 mesmo quando a gravação falha porque o Asaas pausa a fila de eventos depois de
várias respostas de erro seguidas. Se algo der errado, a cobrança aparece no log e pode ser
reenviada pelo painel do Asaas.

As cobranças do Asaas aparecem na aba própria e ainda não entram no Recebido, no DRE nem nas
cobranças geradas pelo sistema em `client_payments`.

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
