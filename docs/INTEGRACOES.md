# Integrações do Sistema SINGLE

Estado de cada sistema externo e o que falta fazer. Atualize as caixas conforme for concluindo.

Última atualização: 2026-10-16

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

Depois disso, os cargos dos demais membros são ajustados em Configurações > Equipe. Desde a migration 0010 (2026-10-16), os cargos são: `Liderança`, `Gestor de Tráfego`, `SDR`, `Closer`, `Estrategista & Analista` e `Colaborador` (no comando acima, use `'Liderança'` no lugar de `'CEO'`).

O que cada cargo vê no menu (a regra está em `src/lib/permissoes.ts`; as rotas seguem a mesma regra):

| Menu | Liderança | Gestor de Tráfego | SDR | Closer | Estrategista & Analista | Colaborador |
|---|---|---|---|---|---|---|
| Dashboard, Demandas, Conteúdo, Calendário | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Clientes, Financeiro, Configurações | ✓ | | | | | |
| CRM | ✓ | | ✓ | ✓ | | |
| Anúncios | ✓ | ✓ | | | ✓ | |

Configurações fica fora do menu de quem não é da Liderança, mas a foto e o nome no rodapé do menu levam para lá: é onde cada um muda o próprio nome, a foto e o tema. No banco, só a Liderança lê dinheiro e muda cargos; leads e a conversão de lead em cliente são da Liderança, SDR e Closer.

### Convite e remoção de colaboradores (Edge Functions)

Em Configurações > Equipe, "Convidar colaborador" chama a função `convidar-colaborador` e a lixeira de cada pessoa chama `remover-colaborador`. As duas usam a chave de serviço do Supabase, que dá acesso total ao banco e não pode ficar no navegador, e só atendem a Liderança.

Como o convite funciona: a função gera um código de 6 caracteres, guarda em `invite_codes` com o cargo escolhido e manda o código por e-mail. A pessoa abre o sistema, escolhe "Criar conta" e usa o e-mail, o código e uma senha. Quem cria a conta é a Edge Function `criar-conta`: ela confere no servidor se o código existe, é daquele e-mail, está no prazo (1 hora) e não foi usado, cria a conta já confirmada e aplica o cargo do convite.

O cadastro público do Supabase fica **desligado** (Authentication > Sign In / Providers > "Allow new users to sign up"): sem convite não há como criar conta, nem chamando a API direto. Se alguém religar essa opção, a porta volta a abrir. **Cuidado:** a opção "Email" em Sign In / Providers (na CLI, `[auth.email] enable_signup`) precisa continuar **ligada**: desligá-la não bloqueia só o cadastro, bloqueia o login por e-mail da equipe inteira ("Email logins are disabled"). Em 2026-10-16 isso aconteceu por alguns minutos e foi revertido. As funções antigas `verificar_codigo_convite` e `usar_codigo_convite` continuam no banco, mas só a chave de serviço chama (migration 0011).

O e-mail **não** sai pelo Supabase Auth (o modelo "Invite user" do painel não é usado): sai pela API do Resend, com o domínio `bysingle.com.br`:

- Remetente: `SINGLE OS <noreply@bysingle.com.br>`
- Assunto: `Você foi convidado para o SINGLE OS — SINGLE`
- Prévia na caixa de entrada: `Olá, [nome], você recebeu acesso ao sistema de gestão da SINGLE...`
- Versão em texto puro junto da HTML, fundo claro e botão para o sistema (ajuda a não cair em spam ou Promoções)

Remover alguém apaga a conta no Auth (o perfil vai junto), tira a pessoa dos responsáveis dos cards, invalida convites pendentes do e-mail dela e manda o e-mail "Seu acesso ao SINGLE OS foi revogado". Ninguém remove a si mesmo.

Segredos em Edge Functions > Secrets: `RESEND_API_KEY` (já cadastrado). Opcionais: `EMAIL_REMETENTE` (outro endereço, ex. `SINGLE OS <contato@bysingle.com.br>`), `EMPRESA_NOME` (padrão `SINGLE`), `APP_URL` (padrão `https://singlehubos.vercel.app`). Os modelos dos dois e-mails estão em `supabase/functions/_shared/emails.ts`.

Publicar (da pasta do projeto, com a CLI logada na conta do SINGLE):

```
npx supabase functions deploy convidar-colaborador --project-ref natiqbpgprmcppcqmlvq
npx supabase functions deploy remover-colaborador --project-ref natiqbpgprmcppcqmlvq
npx supabase functions deploy criar-conta --project-ref natiqbpgprmcppcqmlvq
```

- [x] `convidar-colaborador` e `remover-colaborador` publicadas (2026-10-16)
- [x] `criar-conta` publicada, migration 0011 aplicada e cadastro público desligado (2026-10-16)
- [x] `site_url` do Auth apontando para `https://singlehubos.vercel.app` (estava em `http://localhost:3000`)

Se os e-mails ainda forem parar no spam, confira no Resend (Domains) se o `bysingle.com.br` tem SPF, DKIM e DMARC verdes.

### Migration 0012 (Base de Clientes, 2026-10-19)

- [x] Aplicada em 2026-10-19 (testada antes no próprio banco, dentro de uma transação desfeita)

Pode rodar mais de uma vez e não apaga nada. Verificações em `supabase/tests/0012_verificacoes.sql`.

| Recurso | Sem a migration | Com a migration |
|---|---|---|
| Área de atuação | não existe | campo no cadastro, coluna na tabela de Clientes e na ficha |
| Responsáveis da SINGLE | não existe | várias pessoas da equipe por cliente (`clients.responsaveis`); quem é removido da equipe sai da lista |
| Contatos | um contato só (`contato_nome`, `contato_email`, `contato_telefone`) | lista com nome, função, e-mail e telefone (`clients.contatos`); o primeiro continua gravado nas colunas antigas. O contato que já existia vira o primeiro da lista |

### Migration 0010 (cargos, CRM do comercial, Áreas e convites, 2026-10-16)

- [x] Aplicada em 2026-10-16 (testada antes no próprio banco, dentro de uma transação desfeita)

Pode rodar mais de uma vez e não apaga nada. Verificações em `supabase/tests/0010_verificacoes.sql`.

| Recurso | Sem a migration | Com a migration |
|---|---|---|
| Cargos | o app trata CEO, Founder e Co-Founder como Liderança e as funções de produção como Colaborador, mas o banco só grava os cargos antigos | os seis cargos novos; os antigos foram convertidos |
| CRM | só a Liderança lê leads | Liderança, SDR e Closer leem e convertem leads |
| Áreas das demandas | lista fixa (Conteúdo, Tráfego, Estratégia, Audiovisual) | engrenagem ao lado do campo Área para criar, renomear, colorir e remover; remover avisa quantas demandas usam a área e só a esconde da lista (`card_options.oculta`) |
| Convites | qualquer visitante lia os códigos em `invite_codes` | a tabela só é lida pela função; o código só vale para a conta do e-mail convidado |
| Remover colaborador | o convite criado pela pessoa travava a exclusão | `invite_codes.created_by` vira nulo e a pessoa sai das listas de responsáveis |

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

### Migration 0008 (perfil do lead, histórico de campanhas e fim do quadro de Tarefas)

- [ ] Rodar `supabase/migrations/0008_crm_campanhas.sql` no SQL Editor (depois da 0007)

Pode rodar mais de uma vez e não apaga nada.

| Recurso | Sem a migration | Com a migration |
|---|---|---|
| Perfil do lead no CRM | o painel do lead mostra nome, empresa, origem e telefone | também Instagram, cidade, temperatura (frio, morno, quente), segmento, faturamento médio, tamanho da equipe e observações |
| Tarefas internas | aparecem no quadro de Demandas, mas anexos e subtarefas delas continuam marcados como do quadro antigo | passam de vez para Demandas, com anexos e subtarefas; tarefa numa coluna que só existia em Tarefas cai na primeira coluna |
| Campanhas | sem plataforma, objetivo e histórico | `campaigns.plataforma` e `campaigns.objetivo`; tabela `campaign_historico` com as otimizações de cada campanha |
| Demanda de anúncio | precisa de uma campanha | a campanha é opcional; a demanda pode ter só o cliente (`campaign_tasks.client_id`) |

### Migration 0009 (vários responsáveis, recorrência das despesas e meta anual)

- [ ] Rodar `supabase/migrations/0009_responsaveis_recorrencia_metas.sql` no SQL Editor (depois da 0008)

Pode rodar mais de uma vez e não apaga nada.

| Recurso | Sem a migration | Com a migration |
|---|---|---|
| Responsáveis de demandas e conteúdos | um responsável por card | vários (`tasks.responsaveis` e `content_cards.responsaveis`); o primeiro continua em `responsavel_id`. Quem já tinha responsável ganha a lista com ele |
| Despesa recorrente | mensal, com quantidade de meses | semanal, quinzenal, mensal, trimestral ou anual, com fim ou sem fim (`expenses.frequencia`, `expenses.sem_fim`) |
| Meta de faturamento | só mensal | mensal e anual (`monthly_goals.tipo`) |

## Asaas (fonte das receitas dos clientes)

O Asaas é a fonte das receitas dos clientes. O sistema não lança nem confirma cobrança de
cliente: o que está no Asaas aparece em Financeiro (Visão Geral, Pagamentos e Relatórios) e na
aba Pagamentos de cada cliente. Despesas continuam lançadas à mão.

Duas Edge Functions gravam as cobranças em `receitas_asaas`, sempre pelo id do Asaas (nada se
repete):

- `asaas-sync`: traz todas as cobranças que já existem. Roda pelo botão **Sincronizar Asaas** em
  Financeiro > Pagamentos, só para a liderança. Pode ser usada de novo a qualquer momento.
- `asaas-webhook`: recebe cada cobrança criada, paga, vencida, estornada ou excluída dali em
  diante.

As duas ligam a cobrança a um cliente daqui nesta ordem: pelo id do cliente do Asaas já gravado
no cliente; pelo CNPJ/CPF (só os dígitos); pelas duas primeiras palavras do nome, sem acento. No
CNPJ e no nome, só quando um único cliente casar. O que não for ligado aparece em Pagamentos com
o botão "Vincular cliente", e o vínculo vale também para as próximas cobranças daquele cliente
do Asaas.

Passo a passo:

- [x] Rodar `supabase/migrations/0006_asaas.sql` no SQL Editor
- [ ] Rodar `supabase/migrations/0007_asaas_fonte.sql` no SQL Editor (CNPJ no cadastro do cliente)
- [ ] Em Edge Functions > Secrets, cadastrar:
  - `ASAAS_API_KEY`: a chave da API do Asaas (Integrações > Chaves de API). Usada pela
    sincronização e pelo webhook, que busca no Asaas o nome e o CNPJ do cliente (o evento só traz
    o id dele)
  - `ASAAS_WEBHOOK_TOKEN`: o token de autenticação do webhook (o mesmo que vai no Asaas)
  - `ASAAS_API_URL` (opcional): só para testar no sandbox, `https://api-sandbox.asaas.com/v3`
- [ ] Publicar as duas funções (da pasta do projeto, com a CLI do Supabase logada na conta do
  SINGLE). A pasta `supabase/functions/_shared` vai junto sozinha:
  ```
  supabase functions deploy asaas-sync --project-ref natiqbpgprmcppcqmlvq
  supabase functions deploy asaas-webhook --no-verify-jwt --project-ref natiqbpgprmcppcqmlvq
  ```
  O webhook vai sem verificação de JWT porque o Asaas não tem login no Supabase; quem o protege
  é o token. A sincronização exige o login de alguém da liderança.
- [ ] No Asaas, em Integrações > Webhooks, criar um webhook com a URL
  `https://natiqbpgprmcppcqmlvq.supabase.co/functions/v1/asaas-webhook`, o mesmo token em
  "Token de autenticação" e os eventos de cobrança marcados
- [ ] Cadastrar o CNPJ dos clientes (Clientes > Editar) e clicar em **Sincronizar Asaas**

Como o webhook responde:

| Situação | Resposta |
|---|---|
| Token ausente ou diferente de `ASAAS_WEBHOOK_TOKEN` | 401, e nada é gravado |
| Evento de cobrança (`PAYMENT_*`) | grava ou atualiza a cobrança pelo id dela e responde 200 |
| Outros eventos (assinatura, conta) | ignorados, 200 |
| Falha ao gravar | vai para o log da função (Edge Functions > asaas-webhook > Logs) e responde 200 |

A resposta é 200 mesmo quando a gravação falha porque o Asaas pausa a fila de eventos depois de
várias respostas de erro seguidas. Se algo der errado, a cobrança aparece no log, e
"Sincronizar Asaas" traz de novo tudo o que estiver no Asaas.

Como os números do Financeiro são calculados:

| Número | Conta |
|---|---|
| MRR ativo | cobranças que vencem no mês (pagas, pendentes ou atrasadas), sem canceladas e estornadas |
| Recebido no mês | cobranças pagas (`RECEIVED`, `CONFIRMED`, `RECEIVED_IN_CASH`) pela data do pagamento |
| A receber no mês | cobranças `PENDING` que vencem no mês |
| Em atraso | cobranças `OVERDUE` |
| Receita do DRE e da meta | o mesmo Recebido no mês |

As cobranças lançadas à mão antes do Asaas (`client_payments`) não são apagadas: aparecem só
para consulta na aba Pagamentos do cliente e não entram em nenhuma conta.

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
