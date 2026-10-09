# Etapa 2 (Operacional) Implementation Plan

**Goal:** Substituir as telas "em construção" por Dashboard, Clientes, Demandas, Conteúdo, Campanhas e Configurações funcionando sobre o Supabase.

**Architecture:** Hooks genéricos de leitura e escrita por tabela (React Query) em `src/dados`, regras de negócio em funções puras testadas em `src/lib/regras.ts`, um componente de quadro Kanban compartilhado entre Demandas e Conteúdo, e junções feitas no cliente (listas de clientes e perfis indexadas por id) para não depender de embeds do PostgREST.

**Tech Stack:** o da etapa 1, mais `@dnd-kit/core`.

**Spec:** `docs/superpowers/specs/2026-10-08-sistema-single-design.md`, com os ajustes abaixo pedidos em 2026-10-08.

## Ajustes em relação à spec

O pedido da etapa 2 difere da spec em alguns pontos. Vale o pedido mais recente:

| Tema | Spec | Etapa 2 (vale este) |
|---|---|---|
| KPIs do Dashboard | demandas abertas, atrasadas, campanhas em execução, otimizações pendentes | MRR total, clientes ativos, tarefas abertas, conteúdos aguardando aprovação |
| Dado financeiro no Dashboard | nenhum | MRR total aparece (é a soma de valores que todos já veem em Clientes) |
| Painéis do Dashboard | Demandas Atrasadas, Próximas Otimizações, Atividade Recente | Próximas entregas (inclui atrasadas em vermelho), Próximas otimizações, Atividade recente |
| Colunas dos quadros | cinco, com Arquivado | quatro; arquivar é uma ação no card, e arquivados somem do quadro |
| Filtros em Demandas | não previstos | por tipo e por responsável |
| Histórico de pagamentos | etapa 3 | entra agora no detalhe do cliente, só para liderança (o banco já bloqueia os demais) |
| Organização do código | `api.ts` por feature | hooks compartilhados em `src/dados`, porque o Dashboard lê quase todas as tabelas |
| Marca | texto "SINGLE" | logotipo vetorial do arquivo da marca, na cor de texto atual |

## Global Constraints

- Mesmas da etapa 1: textos em português, TypeScript strict, sem traços como separadores, animações nativas com `prefers-reduced-motion`.
- Não alterar cores, tipografia nem o layout da sidebar.
- Toda mutação mostra toast de sucesso ou erro.
- Registrar no `activity_log`: criar cliente, criar e mover demanda, criar e mover conteúdo (publicar), criar campanha, registrar otimização.
- Publicar com `vercel deploy --prod` ao concluir cada módulo.

## Tasks

- [x] 1. Base: `@dnd-kit/core`, `src/lib/regras.ts` com testes, `src/lib/rotulos.ts`, `src/dados` (hooks genéricos, atividade, storage), componentes de UI (Modal, Drawer, Pill, KpiCard, Selecao, AreaTexto, Estado), logotipo.
- [x] 2. Dashboard. Deploy.
- [x] 3. Clientes: grid, modal de cadastro e edição, drawer de detalhe, upload de logo, pagamentos. Deploy.
- [x] 4. Quadro Kanban compartilhado; Demandas com filtros. Deploy.
- [x] 5. Conteúdo. Deploy.
- [x] 6. Campanhas: lista, criação, detalhe com estratégia, otimização e tarefas por função. Deploy.
- [x] 7. Configurações: perfil, avatar, equipe. Deploy.
- [x] 8. Verificação final: testes, build, checagem das colunas contra a API.

Estado em 2026-10-08: as oito tarefas estão concluídas na branch `etapa-2-operacional`. Ficaram pendentes a publicação (`vercel deploy --prod` não foi autorizado na sessão que concluiu o trabalho) e o logotipo vetorial (o arquivo da marca não está no repositório).

## Review Focus

1. Listas vazias em um banco recém-criado: cada tela mostra estado vazio com a ação de criar, sem erro.
2. Falha de rede ou de permissão ao salvar: toast de erro e o quadro volta ao estado anterior.
3. Tarefa ou card apontando para cliente ou responsável que não existe mais: mostra "Sem cliente" ou "Sem responsável".
4. Valores monetários digitados com vírgula ("1.500,50"): aceitos e convertidos.
5. Upload de arquivo que não é imagem ou é grande demais: recusado com mensagem clara.
