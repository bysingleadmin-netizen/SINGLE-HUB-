# Etapa 3 (Redesign e novos módulos) Implementation Plan

**Goal:** Refazer a camada visual do SINGLE OS e acrescentar Calendário, Notificações, aba Equipe com convite, busca global e as melhorias pedidas em Dashboard, Clientes, Demandas e Conteúdo.

**Architecture:** A mesma da etapa 2: hooks por tabela em `src/dados`, regras em funções puras testadas, componentes compartilhados em `src/components`. O que é novo: tokens de vidro fosco em `global.css`, um `Drawer` de edição no quadro, página de detalhe do cliente com abas, e três tabelas (`calendar_events`, `event_participants`, `notifications`) que já existem no banco.

**Tech Stack:** o da etapa 2. Gráfico em SVG próprio, sem biblioteca.

**Spec:** o pedido de 2026-10-08 ("SINGLE OS: redesign visual + novos módulos"). Vale sobre a spec original onde diferir.

## Tabelas novas (lidas da API em 2026-10-08)

| Tabela | Colunas |
|---|---|
| `calendar_events` | `id`, `titulo`, `descricao`, `tipo` (texto), `data_inicio` e `data_fim` (timestamptz), `dia_inteiro` (boolean), `client_id`, `created_by`, `created_at` |
| `event_participants` | `event_id`, `profile_id` |
| `notifications` | `id`, `user_id`, `tipo` (texto), `titulo`, `mensagem`, `link`, `lida` (boolean), `created_at` |

Não foi possível ler as restrições de `tipo` nem as políticas de RLS. O app grava `tipo` do evento como `reuniao`, `gravacao`, `entrega`, `otimizacao` ou `outro`, e `tipo` da notificação como `tarefa`, `evento` ou `prazo`.

## Ajustes em relação ao pedido

| Tema | Pedido | Como fica |
|---|---|---|
| Convite de colaborador | `supabase.auth.admin.inviteUserByEmail` chamado pelo app | A função exige a chave `service_role`, que não pode ir para o navegador. O app chama a Edge Function `convidar-colaborador`, que confere se quem pede é da liderança e só então convida. O código da função fica em `supabase/functions`; publicar é um passo manual no Supabase |
| Publicação | `vercel deploy --prod` | Push em `main`: a Vercel do SINGLE publica sozinha, e a CLI desta máquina está em outra conta |
| MRR dos últimos 6 meses | gráfico | Não há histórico de MRR no banco. Cada mês soma o MRR atual dos clientes ativos cujo contrato já tinha começado |
| Edição no quadro | drawer com campos inline | Criar continua em modal; abrir um card existente usa o drawer, que salva campo a campo |
| Detalhe do cliente | página com abas | Substitui o drawer. A aba Pagamentos só aparece para a liderança |

## Global Constraints

- As da etapa 2: textos em português, TypeScript strict, sem traços como separadores, `prefers-reduced-motion` respeitado.
- Toda mutação mostra toast. Falha ao notificar nunca interrompe a ação principal.
- Não usar `vercel deploy` nem o conector do Supabase desta máquina: os dois apontam para contas que não são do SINGLE.

## Tasks

- [x] 1. Logo em cor única.
- [x] 2. Redesign visual: rastro do mouse, vidro fosco, campos, entradas com stagger de 50 ms, hovers, botão primário, sidebar, scrollbar, ilustrações nos estados vazios, toasts de 3 s.
- [x] 3. Notificações: sino com contagem, lista das 20 mais recentes, marcar como lida e navegar; disparos por tarefa atribuída, evento com participantes e prazo de amanhã.
- [x] 4. Calendário: rota, item na sidebar, grade mensal com chips por tipo, painel do dia, modal de evento com cliente e participantes.
- [x] 5. Configurações com abas; aba Equipe só para a liderança, com cargo inline e convite.
- [x] 6. Quadro: indicador de prazo colorido, chip de cliente, drawer de edição em Demandas e Conteúdo.
- [x] 7. Clientes: ações rápidas no card e página de detalhe com abas.
- [x] 8. Dashboard: gráfico de MRR e seção Hoje.
- [x] 9. Busca global com Ctrl+K.
- [x] 10. Verificação final: testes, build, colunas contra a API, push.

Estado em 2026-10-08: as dez tarefas estão concluídas. Ficam fora do código, como passos manuais no Supabase do SINGLE: publicar a Edge Function `convidar-colaborador` e conferir RLS e valores de `tipo` das três tabelas novas (lista em `docs/INTEGRACOES.md`).

## Review Focus

1. Banco sem eventos nem notificações: calendário e sino mostram estado vazio, sem erro.
2. Inserção recusada em `notifications` ou `event_participants` (RLS ou restrição de `tipo`): a tarefa ou o evento continuam salvos e o usuário vê o toast da ação principal.
3. Evento que atravessa a meia-noite ou dura vários dias: aparece em todos os dias que cobre.
4. Fuso: evento criado às 23h aparece no dia certo no navegador de quem criou.
5. Busca com acentos e maiúsculas ("clinica" acha "Clínica").
6. Aviso de prazo de amanhã não se repete a cada recarga da página.
7. Quem não é da liderança não vê a aba Equipe, a aba Pagamentos nem o botão de convite.
