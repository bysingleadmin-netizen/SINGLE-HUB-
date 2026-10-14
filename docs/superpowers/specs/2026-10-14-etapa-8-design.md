# Etapa 8: atividade recolhível, contratos, pagamentos parciais, quadros por tipo e CRM

Origem: Prompts 7 a 11 do Luan (2026-10-14). Decisões tomadas com ele na conversa:

- "Tarefa" é trabalho interno da agência; "Demanda" segue sendo o pedido do cliente; "Anúncio" vira quadro com as tarefas de anúncio; "Conteúdo" não muda.
- Indicadores em R$ no Dashboard (MRR, ARR) e os do CRM aparecem só para a liderança.
- O CRM inteiro é só da liderança, no app e no banco.

## Banco: migration 0004

Arquivo único `supabase/migrations/0004_etapa8.sql`, idempotente (pode rodar mais de uma vez), dentro de `begin/commit`, validado em PGlite como a 0003 (rodar a 0001, o que o painel criou, a 0003 e a 0004 duas vezes). Ela cresce a cada bloco. O app detecta cada coluna ou tabela nova (`src/dados/esquema.ts` ou o código de "tabela ausente") e funciona sem ela, com o recurso escondido.

| Bloco | Mudança |
|---|---|
| Contrato | `clients.contrato_meses smallint check (contrato_meses in (3, 6, 12, 15))` |
| Pagamentos | `client_payments.valor_pago numeric(12,2) not null default 0 check (valor_pago >= 0)`, `pago_em date`, `observacao_pagamento text`; preenche `valor_pago = valor` e `pago_em = data_pagamento` onde `status = 'pago'` |
| Quadros | `tasks.quadro text not null default 'demandas' check (quadro in ('demandas', 'tarefas'))`; `tasks.tipo` deixa de ser obrigatório (Tarefas não tem tipo); a lista fechada de `campaign_tasks.status` sai (colunas personalizadas) e fica `status <> ''`; os checks de `quadro` em `board_columns`, `card_attachments`, `card_subtarefas` passam a aceitar `('demandas', 'conteudo', 'tarefas', 'anuncios')`; `card_options.cor text` (hex `#rrggbb`) |
| CRM | tabelas `leads` e `lead_historico`, função `converter_lead`, RLS só liderança; `leads` e `clients` entram na publicação `supabase_realtime` |

Não é criada `clients.contrato_inicio`: o início do contrato é a `data_inicio_contrato` que já existe e já define as cobranças.

## 1. Atividade recente recolhível (Prompt 11)

- `Atividade` mostra, recolhida, os 4 registros mais recentes. "Ver mais" expande para todos os registros das últimas 24 horas; "Recolher" volta para 4. O agrupamento por dia (HOJE, ONTEM) vale nos dois modos.
- Registros com mais de 24 horas não aparecem na lista expandida. O link "Ver histórico completo", no rodapé do painel, abre um `Modal` com o histórico inteiro, agrupado por dia, carregado de 50 em 50 ("Carregar mais").
- Consulta: `useAtividadeRecente` passa a buscar as últimas 24 horas (`created_at >= agora - 24h`), e uma consulta paginada nova (`useHistoricoDeAtividade`) serve o modal.
- O estado expandido fica em `localStorage` (`single:atividade-expandida`), com leitura e escrita em `try/catch`; sem armazenamento, começa recolhida.
- Sem registros nas últimas 24 horas, o painel mostra os 4 mais recentes que houver, para não ficar vazio sem motivo.

## 2. Contrato de fidelidade (Prompt 9)

- `ClienteModal` ganha o select "Duração do contrato" (3, 6, 12, 15 meses, ou vazio). O campo de data de início que já existe passa a se chamar "Data de início do contrato".
- Regras puras em `src/features/clientes/contrato.ts`:
  - `tempoDeCasa(inicio, hoje)`: meses completos desde o início ("8 meses", "1 mês", "Menos de 1 mês").
  - `fimDoContrato(inicio, meses)`: início somado aos meses.
  - `situacaoDoContrato(fim, hoje)`: `vigente` (selo cinza "Encerra em mar/2027"), `perto` (30 dias ou menos, amarelo), `vencido` (vermelho, "Encerrou em mar/2027").
- O card do cliente em `ClientesPage` e o cabeçalho de `ClientePage` mostram o tempo de casa e o selo. Sem duração, só o tempo de casa; sem data de início, nada.

## 3. Pagamentos parciais (Prompt 8)

- Regras puras em `src/features/clientes/cartoes.ts`:
  - `situacaoDoPagamento(valor, valorPago)`: `pago` (pago >= total), `parcial` (0 < pago < total), `pendente` (0).
  - Selo: Pago verde, Parcial amarelo, Pendente vermelho. O atraso continua como texto ao lado ("3 dias de atraso").
- Botão "Editar" em cada cobrança abre `EditarPagamentoModal`: valor total, valor já pago, data do pagamento parcial, observação; o restante (total menos pago) é mostrado ao vivo e não aceita pago maior que o total. Salvar com pago igual ao total marca `status = 'pago'`, `data_pagamento = pago_em` e arquiva como hoje; abaixo disso, volta a `pendente` (ou `atrasado`, pela data).
- Pix e Dinheiro continuam e quitam o restante (`valor_pago = valor`).
- Visão "Por cliente" em `PagamentosDosClientes`, ao lado de "Em aberto" e "Histórico": um seletor de mês (padrão: mês atual) e uma linha por cliente com barra de progresso: "Scofield: R$ 2.000,00 pagos de R$ 2.870,00 (69%)". Conta as cobranças com `mes_referencia` no mês escolhido, exceto as canceladas.
- Resumo do Financeiro: "Recebido" soma só `valor_pago` com `pago_em` (ou `data_pagamento`) no mês; "A receber" mostra à parte a soma dos restantes em aberto e nunca entra no recebido, na DRE nem no faturamento.
- Sem a migration: o botão Editar não aparece e tudo segue como hoje.

## 4. Quadros por tipo e status com cor (Prompt 7)

- Menu, grupo "Produção": Tarefas (`/app/tarefas`), Demandas, Conteúdo, Anúncios. Cada um abre direto o seu quadro.
- **Tarefas:** página nova sobre a mesma tabela `tasks`, filtrada por `quadro = 'tarefas'`, com colunas próprias (`board_columns.quadro = 'tarefas'`) e o mesmo painel, comentários, subtarefas, anexos e ciclo de arquivamento. O campo e o filtro "Tipo" não aparecem. Demandas passa a filtrar `quadro = 'demandas'`. A página de Demandas é generalizada para receber o quadro (`'demandas' | 'tarefas'`), e as duas rotas usam o mesmo componente.
- **Anúncios:** `/app/anuncios` abre o quadro das tarefas de anúncio (`campaign_tasks`), usando o componente `Quadro`, com colunas próprias (`board_columns.quadro = 'anuncios'`, padrão Pendente, Em andamento, Concluído). A lista de campanhas vira a aba "Campanhas" da mesma página; `/app/anuncios/:id` não muda. A lista de tarefas que existia continua como a visão "Lista".
- **"+ Criar":** o botão do cabeçalho aparece só em `/app/tarefas`, `/app/demandas`, `/app/conteudo` e `/app/anuncios` (e subrotas). O atalho de teclado segue a mesma regra. No modal, o campo "Categoria" vira "Tipo", com as opções Tarefa, Conteúdo, Demanda e Anúncio; a página atual define o tipo inicial.
- **Cor dos status:** `card_options.cor`. A engrenagem (`ConfigurarOpcoes`) ganha um `<input type="color">` por opção. A cor aparece no selo do card, no seletor de status (fundo e borda tingidos, como hoje com o tom) e na rosca do Dashboard. Opções sem cor salva usam a padrão do código: Travado `#f04444`, Em andamento `#4a9eff` (antes amarelo), Feito `#3ecf8e`; as criadas pela equipe começam em cinza `#8d8d99`. As cores valem também para prioridade e tipo de conteúdo, que usam o mesmo modal.
- "Status" de cada quadro são as colunas dele, que já são separadas por quadro. O selo Travado/Em andamento/Feito continua sendo uma lista só, compartilhada.

## 5. CRM de leads (Prompt 10)

- Menu "CRM" (`/app/crm`) abaixo de Clientes, com `apenasLideranca`. A rota usa `RotaLideranca`.
- Tabela `leads`: `id`, `nome` (obrigatório), `empresa`, `telefone`, `origem`, `etapa` (`'leads' | 'reuniao' | 'fechamento'`), `etapa_desde timestamptz`, `posicao`, `convertido_em timestamptz`, `client_id` (cliente criado), `created_by`, `created_at`.
- Tabela `lead_historico`: `id`, `lead_id` (cascade), `etapa_de`, `etapa_para` (inclui `'cliente'`), `user_id`, `created_at`. Gravada pelo app a cada movimentação e pela função de conversão.
- RLS das duas: só `private.is_lideranca()` lê e escreve.
- Quadro com 4 colunas fixas: Leads, Reunião, Fechamento de contrato, Cliente. Nomes fixos, sem renomear ou criar. A coluna Cliente fica sempre vazia: é só o destino da conversão.
- Card: nome, empresa, telefone com botão de WhatsApp (`https://wa.me/55{dígitos}`; se os dígitos já começam com 55 e têm 12 ou 13 dígitos, não repete), origem e "na etapa há 3 dias". Criar lead pelo botão do quadro (o "+ Criar" do cabeçalho não aparece no CRM).
- Conversão: soltar um card em Cliente não move nada e abre um modal obrigatório (nome do cliente, preenchido com a empresa ou o nome; MRR; duração 3/6/12/15; data de início). Cancelar deixa o card onde estava. Confirmar chama a função `public.converter_lead(lead_id, nome, mrr, meses, inicio)` (`security definer`, recusa quem não é liderança), que numa transação cria o cliente ativo, marca o lead com `convertido_em` e `client_id` e grava o histórico. O card sai do quadro; o lead não é apagado, para a taxa de conversão. Registro no log de atividade "converteu o lead X em cliente".
- Dashboard, só liderança: MRR total (soma do MRR dos clientes ativos), ARR (MRR × 12), clientes ativos, leads no pipeline (não convertidos), conversão em 30 dias (leads convertidos nos últimos 30 dias ÷ leads criados nos últimos 30 dias; sem leads criados, mostra "—"). Atualizados em tempo real (`useTempoReal(['clients', 'leads'])`). Para os demais, o Dashboard fica como hoje.
- Sem a migration: o menu CRM mostra o aviso de migração pendente, e os KPIs de leads mostram "—".

## Testes

Cada bloco com testes de unidade nas regras puras (contrato, situação do pagamento, conversão de telefone, taxa de conversão, recolher atividade) e testes de tela com o Supabase falso nos fluxos principais (editar pagamento parcial, conversão obrigatória, "+ Criar" escondido fora dos quadros, quadro de Tarefas separado do de Demandas). Migration validada em PGlite. Conferência visual em 375px e desktop pela prévia local.

## Entrega

Blocos na ordem: 1+2, 3, 4, 5. Cada bloco termina com tipos, testes e build passando, commit na `main`, push e conferência de que o site trocou de versão.
