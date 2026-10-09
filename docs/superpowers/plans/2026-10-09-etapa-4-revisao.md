# Etapa 4 (Revisão: criação central, calendário cruzado, pagamentos recorrentes) Implementation Plan

**Goal:** Aplicar a revisão pedida em 2026-10-09: QA visual, um único fluxo de criação de tarefas, calendário que mostra entregas automaticamente e pagamentos mensais gerados a partir do cadastro do cliente.

**Architecture:** Sem tabelas novas. A criação central é um provedor (`CriacaoProvider`) que qualquer tela aciona; cada categoria continua gravando na sua tabela (`tasks`, `content_cards`, `campaign_tasks`). O calendário e os cartões de pagamento são calculados na hora a partir dos dados existentes; só o pagamento confirmado é gravado.

**Spec:** o pedido de 2026-10-09 ("revisão completa do SINGLE OS"). Vale sobre os planos anteriores onde diferir.

## O que o banco tem e não tem (lido da API em 2026-10-09)

- `clients` não tem campo de vencimento. `client_payments` não tem campo para a forma de pagamento.
- A migration `supabase/migrations/0002_pagamentos_recorrentes.sql` cria `clients.dia_vencimento` e `client_payments.forma_pagamento`. O app detecta se elas existem e funciona nos dois casos.

## Ajustes em relação ao pedido

| Tema | Pedido | Como fica |
|---|---|---|
| Data de vencimento | "já existe" no cadastro | Não existe no banco. Sem a migration, vence no mesmo dia do mês em que o contrato começou. Com a migration, o cadastro ganha o campo "Dia do vencimento" |
| Forma de pagamento | botões Pix e dinheiro | Os dois confirmam o pagamento. A forma só fica gravada depois da migration; antes disso o app avisa que ela não foi registrada |
| Cartões mensais | gerados a partir do início do contrato | Calculados na tela, do mês de início até o mês atual. No banco só entram o mês pago e o cartão do mês seguinte |
| Valor ou data alterados | refletem nos cartões futuros | Todo mês ainda não pago usa o valor e o dia atuais do cadastro; mês pago guarda o que foi pago |
| Criação central | botão "+" global | Botão Criar no cabeçalho. O "+" das colunas continua e abre o mesmo formulário já na coluna. Os botões "Nova demanda" e "Novo conteúdo" das telas saem. "Nova campanha" fica, porque campanha não é tarefa |
| Categorias | tarefa roteada pelo tipo | Demanda, Conteúdo e Tarefa de campanha. Cada uma grava na tabela que o seu menu lê |
| Calendário | tarefas com data aparecem sozinhas | Demandas e conteúdos com data de entrega, fora os arquivados. Nada é copiado para `calendar_events` |
| Rótulos do gráfico | 11 px, cor `#666` | Feito como pedido, mesmo ficando abaixo do contraste dos demais textos |
| Publicação | deploy no Vercel | Push em `main` |
| Financeiro | não tocar | Não tocado |

## Tasks

- [ ] 1. QA visual: brilho do mouse sem borda visível, contraste dos textos secundários, ícones de estado vazio (28 px, traço 1,5, opacidade 0,25), gráfico de MRR na altura do card vizinho.
- [ ] 2. Criação central: provedor, modal com categoria, botão no cabeçalho, telas sem botões próprios; filtros em Conteúdo e em Campanhas.
- [ ] 3. Calendário cruzado: demandas e conteúdos com data entram na grade e no painel do dia; seção Hoje do Dashboard usa a mesma agenda.
- [ ] 4. Pagamentos recorrentes: cartões mensais calculados, confirmar com Pix ou dinheiro, cartão do mês seguinte, campo de vencimento no cadastro, migration 0002.
- [ ] 5. Verificação final: testes, build, capturas das telas afetadas, push.

## Review Focus

1. Cliente sem data de início de contrato: a aba Pagamentos explica o que falta, sem erro.
2. Contrato iniciado no dia 31: o vencimento cai no último dia nos meses mais curtos.
3. Banco sem a migration 0002: cadastrar cliente e confirmar pagamento continuam funcionando.
4. Confirmar pagamento recusado pelo banco: o cartão continua em aberto e aparece o toast de erro.
5. Demanda concluída ou arquivada no calendário: concluída aparece apagada, arquivada não aparece.
6. Criar pela categoria Campanha sem nenhuma campanha cadastrada: o formulário manda criar uma antes.
7. Quem não é da liderança não vê cartões de pagamento.
