# Sistema SINGLE: design

Data: 2026-10-08
Status: aguardando revisão

## 1. Objetivo

Sistema interno de gestão da agência SINGLE. Reúne em um só lugar a operação (clientes, demandas, conteúdo, campanhas) e o financeiro (receita, despesas, DRE, metas), com o financeiro visível apenas para a liderança.

Sucesso significa: a equipe abre o Dashboard e sabe o que está atrasado e o que precisa ser otimizado hoje; a liderança abre o Financeiro e sabe quanto entrou, quanto falta e quem está devendo.

## 2. Escopo

Dentro: login, Dashboard operacional, Clientes, Demandas (Kanban), Conteúdo (pipeline), Campanhas, Financeiro (4 abas), Configurações, notificações no header.

Fora da primeira versão: cadastro público, convite de membros pelo app, integrações com Meta Ads ou WhatsApp (métricas de tráfego são digitadas), envio de e-mails pelo app, portal do cliente.

## 3. Stack

| Camada | Escolha |
|---|---|
| App | React 18, Vite, TypeScript em modo strict |
| Rotas | React Router |
| Dados | Supabase (Postgres, Auth, Storage) via `@supabase/supabase-js` |
| Cache | TanStack React Query |
| Drag and drop | `@dnd-kit/core` e `@dnd-kit/sortable` |
| Gráfico | Recharts |
| Estilo | CSS Modules com variáveis CSS (tokens), sem framework de UI |
| Testes | Vitest e React Testing Library |

Toasts, skeletons, modal, drawer e tooltip são componentes próprios.

## 4. Arquitetura

SPA que fala direto com o Supabase. Não há backend próprio. Toda regra de acesso que importa é aplicada no banco com RLS; a interface apenas reflete essas regras.

```
src/
  lib/            supabase.ts, queryClient.ts, datas.ts, formato.ts, permissoes.ts
  components/ui/  Button, Modal, Drawer, Toast, Skeleton, Pill, Avatar, Tooltip, KpiCard
  layouts/        AppLayout (Sidebar, Header, Notificacoes), AuthLayout
  features/
    auth/         login, sessão, guarda de rota
    dashboard/
    clientes/
    demandas/
    conteudo/
    campanhas/
    financeiro/   dashboard, lancamentos, dre, meta-trafego
    configuracoes/
    atividade/    registrarAtividade() e leitura do activity_log
  types/          database.ts (tipos das tabelas)
supabase/
  migrations/     0001_schema.sql
```

Cada feature tem: `api.ts` (hooks do React Query), componentes e a página. Uma feature só importa de `lib`, `components/ui`, `types` e `atividade`. Lógica de cálculo (fidelidade, dias em atraso, CPL, DRE) fica em funções puras em `lib` ou no próprio feature, testadas isoladamente.

### Rotas

| Rota | Tela | Acesso |
|---|---|---|
| `/login` | Login | público |
| `/app/dashboard` | Dashboard | autenticado |
| `/app/clientes` | Clientes | autenticado |
| `/app/demandas` | Demandas | autenticado |
| `/app/conteudo` | Conteúdo | autenticado |
| `/app/campanhas` | Lista de campanhas | autenticado |
| `/app/campanhas/:id` | Detalhe da campanha | autenticado |
| `/app/financeiro/:aba?` | Financeiro | liderança |
| `/app/configuracoes` | Configurações | autenticado |

Sem sessão, qualquer rota `/app` redireciona para `/login`. Sem cargo de liderança, `/app/financeiro` redireciona para `/app/dashboard` com o toast "Acesso não autorizado."

### Sem credenciais

Se `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` estiverem vazias, o app mostra a tela "Configuração pendente" listando as variáveis que faltam, em vez de quebrar.

## 5. Usuários e permissões

Cargos: CEO, Founder, Co-Founder (liderança) e Gestor de Tráfego, Social Media, Designer, Editor de Vídeo, Copywriter.

| Recurso | Liderança | Demais |
|---|---|---|
| Clientes, demandas, conteúdo, campanhas, atividade | ler e escrever | ler e escrever |
| MRR no card e no drawer do cliente | vê | vê |
| Histórico de pagamentos | ler e escrever | sem acesso |
| Despesas, metas, métricas de tráfego | ler e escrever | sem acesso |
| Próprio perfil (nome, avatar) | edita | edita |
| Cargo de outros membros | edita | sem acesso |

O MRR aparece para todos em Clientes porque o prompt original pede o valor no card. Pagamentos, despesas, metas e métricas são bloqueados por RLS, então um usuário comum não os obtém nem chamando a API direto.

Login por e-mail e senha. Não há cadastro público: usuários são criados no painel do Supabase. Um trigger cria a linha em `profiles` com cargo "Social Media"; a liderança ajusta o cargo em Configurações. O primeiro CEO tem o cargo definido direto no banco (passo documentado em `docs/INTEGRACOES.md`).

## 6. Banco de dados

Uma migration (`supabase/migrations/0001_schema.sql`) cria tudo. Todas as tabelas têm `id uuid` e `created_at timestamptz`, salvo indicação.

| Tabela | Colunas principais |
|---|---|
| `profiles` | `id` (igual a `auth.users.id`), `nome`, `email`, `cargo`, `avatar_url` |
| `clients` | `nome`, `logo_url`, `status` (ativo, pausado, churn), `mrr`, `data_inicio_contrato`, `instagram`, `link_conta_anuncios`, `contato_nome`, `contato_email`, `contato_telefone`, `observacoes` |
| `client_payments` | `client_id`, `mes_referencia`, `valor`, `data_vencimento`, `data_pagamento`, `status` (pendente, pago, atrasado) |
| `tasks` | `titulo`, `descricao`, `client_id`, `responsavel_id`, `tipo` (conteudo, trafego, estrategia, audiovisual), `status` (a_fazer, em_andamento, aguardando_aprovacao, concluido, arquivado), `data_entrega`, `posicao`, `created_by` |
| `content_cards` | `titulo`, `tipo_conteudo` (reels, carrossel, post, stories, video), `client_id`, `responsavel_id`, `etapa` (captar_material, editar, aguardando_aprovacao, publicado, arquivado), `data_entrega`, `observacoes`, `posicao` |
| `campaigns` | `nome`, `client_id`, `status` (planejamento, em_execucao, pausada, finalizada), `data_inicio`, `data_fim`, `orcamento`, `estrategia`, `proxima_otimizacao` |
| `campaign_tasks` | `campaign_id`, `funcao` (copy, criativos, captacao_material, trafego, estrategia), `titulo`, `status` (pendente, em_andamento, concluido), `responsavel_id` |
| `expenses` | `descricao`, `categoria`, `valor`, `data`, `forma_pagamento`, `created_by` |
| `monthly_goals` | `mes` (único), `meta` |
| `traffic_metrics` | `mes` (único), `investimento`, `leads_instagram`, `leads_whatsapp`, `convertidos` |
| `activity_log` | `user_id`, `acao`, `descricao`, `entidade`, `entidade_id` |

Storage: bucket público `logos` (logos de clientes) e `avatars`.

### RLS

- Função `is_lideranca()` (security definer) verifica o cargo do usuário atual.
- `client_payments`, `expenses`, `monthly_goals`, `traffic_metrics`: todas as operações exigem `is_lideranca()`.
- `clients`, `tasks`, `content_cards`, `campaigns`, `campaign_tasks`: todas as operações para qualquer autenticado.
- `activity_log`: leitura e inserção para autenticados; sem update nem delete.
- `profiles`: leitura para autenticados; cada um atualiza o próprio perfil; um trigger impede alterar `cargo` sem ser liderança.

### Regras de cálculo

Todas usam a data local do navegador como "hoje" e comparam datas sem hora.

- **Demanda atrasada:** `data_entrega < hoje` e status diferente de concluído e arquivado.
- **Otimização pendente:** `proxima_otimizacao <= hoje` e campanha em execução.
- **Próximas otimizações (Dashboard):** `proxima_otimizacao <= hoje + 3 dias`, campanha em execução.
- **Registrar otimização:** `proxima_otimizacao = hoje + 2 dias`.
- **Pagamento atrasado:** status "atrasado", ou status "pendente" com `data_vencimento < hoje`. Dias em atraso contam a partir do vencimento.
- **Fidelidade:** meses completos entre `data_inicio_contrato` e hoje.
- **MRR total:** soma de `mrr` dos clientes ativos. **ARR:** MRR x 12.
- **Receita do mês:** soma de `client_payments` pagos com `data_pagamento` no mês.
- **DRE:** receita bruta do mês, menos soma de `expenses` do mês, igual a resultado líquido.
- **CPL:** investimento dividido pelo total de leads (Instagram + WhatsApp). **Conversão:** convertidos dividido pelo total de leads, em %. Com zero leads, ambos mostram "sem dados".

## 7. Telas

### Layout

Sidebar fixa à esquerda, 220px, colapsável para 60px (só ícones), estado lembrado no navegador. Itens: Dashboard, Clientes, Demandas, Conteúdo, Campanhas, Financeiro (só liderança), Configurações. Badge vermelho em Demandas (atrasadas) e Campanhas (otimizações pendentes). Rodapé com avatar, nome e cargo. No mobile a sidebar vira menu hambúrguer em gaveta.

Header com título da tela e sino de notificações com badge do total. O dropdown lista demandas atrasadas, campanhas com otimização pendente e, para a liderança, pagamentos atrasados. Cada item leva à tela correspondente. Badges e sino usam as mesmas queries das telas.

### Dashboard

Sem dado financeiro. KPIs: demandas abertas, demandas atrasadas (vermelho se maior que zero), campanhas em execução, otimizações pendentes. Painéis: Demandas Atrasadas (título, cliente, responsável, dias em atraso), Próximas Otimizações (campanha, cliente, data, botão "Marcar como otimizado") e Atividade Recente (10 últimas entradas, com ícone e tempo relativo).

### Clientes

Grid de cards (3 colunas no desktop, 1 no mobile): logo 40x40 ou iniciais, nome, pill de status, MRR, fidelidade. Botão "Novo cliente". O clique abre drawer à direita com logo maior, nome, status editável, fidelidade, MRR e ARR, Instagram como link, botão "Abrir conta de anúncios", contato, upload de logo, observações editáveis inline e, para a liderança, histórico de pagamentos (mês, valor, vencimento, status) com as ações "Adicionar pagamento" e "Marcar como pago".

### Demandas

Kanban com as colunas A Fazer, Em Andamento, Aguardando Aprovação, Concluído, Arquivado. Card: título, cliente (logo e nome), responsável (avatar com tooltip), data de entrega, tag de tipo. Cores das tags com fundo translúcido: Conteúdo `#4a9eff`, Tráfego `#e63030`, Estratégia `#a855f7`, Audiovisual `#e6a630`. Card atrasado tem borda vermelha com pulse suave. Drag and drop entre colunas com atualização otimista e reversão em caso de erro. Botão de criar em cada coluna abre modal com todos os campos; clicar no card abre o mesmo modal para edição.

### Conteúdo

Pipeline horizontal: Captar Material, Editar, Aguardando Aprovação, Publicado, Arquivado. Card: título, tipo de conteúdo, cliente, responsável, data de entrega. Mesmo mecanismo de drag and drop das Demandas (componente de quadro compartilhado). Modal de criação e edição com título, tipo, cliente, responsável, data e observações.

### Campanhas

Lista: nome, cliente, pill de status, datas, orçamento, alerta de otimização pendente. Botão "Nova campanha". Detalhe: header com os dados, estratégia em textarea salva ao sair do campo, tarefas agrupadas por função (Copy, Criativos, Captação de Material, Tráfego, Estratégia) com status e responsável por tarefa, botão "Registrar otimização" e alerta vermelho quando a otimização está pendente.

### Financeiro

Quatro abas.

- **Dashboard Financeiro:** KPIs (MRR total, ARR, recebido no mês, total em atraso), gráfico de área com o faturamento dos últimos 6 meses, alertas de pagamentos atrasados (cliente, valor, dias em atraso) e top 5 clientes por fidelidade.
- **Lançamentos:** formulário de despesa (descrição, categoria, valor, data, forma de pagamento), lista com filtro por período e categoria, total do período em destaque.
- **DRE:** mês selecionável com receita bruta, despesas e resultado líquido; tabela comparativa dos últimos 6 meses.
- **Meta e Tráfego:** meta do mês com barra de progresso, percentual e valor que falta; formulário de métricas (mês, investimento, leads Instagram, leads WhatsApp, convertidos); CPL e conversão calculados; histórico mensal.

### Configurações

Meu perfil (nome, avatar). Para a liderança, lista da equipe com edição de cargo.

## 8. Visual e movimento

Tema escuro único. Fundo quase preto, superfícies em cinzas neutros, vermelho `#e63030` como cor de destaque e de alerta. Tokens em variáveis CSS (`--bg`, `--surface`, `--border`, `--text`, `--accent` e afins).

- Nenhum traço ou hífen como separador visual: separação por gap, padding, borda ou gradiente.
- Entradas com fadeUp e stagger em listas e grids; countUp nos KPIs; `@keyframes` e transitions nativos.
- Skeleton com shimmer vermelho e cinza em todo dado assíncrono.
- Sob `prefers-reduced-motion`, animações decorativas (stagger, countUp, pulse, shimmer) são desativadas.
- Todos os textos em português; valores em `R$` no formato brasileiro; datas em `dd/mm/aaaa`.

## 9. Erros e feedback

Toda mutação mostra toast de sucesso ou de erro. Erros de leitura mostram estado de erro no painel com botão "Tentar novamente". Listas vazias têm estado vazio com a ação de criar. Mutações de arrastar são otimistas e revertem se o banco recusar.

## 10. Registro de atividade

`registrarAtividade()` grava em `activity_log` ao: criar demanda, mover demanda, criar ou mover card de conteúdo, criar campanha, registrar otimização, adicionar cliente. Falha ao registrar não bloqueia a ação principal.

## 11. Testes

- Unitários (Vitest) para as regras da seção 6: atraso, otimização, fidelidade, pagamento atrasado, DRE, CPL, conversão, formatação.
- Componentes (Testing Library): guarda de rota do Financeiro, visibilidade do item Financeiro e do histórico de pagamentos por cargo, tela "Configuração pendente".
- Telas completas são verificadas manualmente com o app rodando contra o Supabase.

## 12. Integrações e pendências

Acompanhadas em `docs/INTEGRACOES.md`, criado na etapa 1 e atualizado a cada sistema conectado.

| Sistema | Para quê | O que falta |
|---|---|---|
| Supabase | banco, login, storage | criar o projeto, rodar a migration, preencher `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, criar o primeiro usuário e marcá-lo como CEO |
| GitHub | repositório do código | criar o repositório e enviar o código |
| Vercel | hospedagem | conectar o repositório, cadastrar as duas variáveis, publicar (o projeto já inclui `vercel.json` com rewrite de SPA) |
| Resend | e-mails do Supabase Auth (redefinição de senha, convites) | criar conta, validar domínio, configurar como SMTP no Supabase. Nenhum código da primeira versão depende disso |

## 13. Etapas de construção

Cada etapa tem seu próprio plano de implementação e termina com o app rodando.

1. **Fundação:** projeto Vite, tokens e componentes de UI, cliente Supabase, tela "Configuração pendente", login, sessão e cargos, layout com sidebar e header, migration completa, `docs/INTEGRACOES.md`.
2. **Operacional:** Dashboard, Clientes, Demandas, Conteúdo, Campanhas, registro de atividade, Configurações.
3. **Financeiro e notificações:** as 4 abas do Financeiro, histórico de pagamentos no drawer do cliente, sino de notificações e badges da sidebar.
