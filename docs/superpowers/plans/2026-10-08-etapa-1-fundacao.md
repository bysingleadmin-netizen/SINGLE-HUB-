# Etapa 1 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o esqueleto do Sistema SINGLE rodando: projeto Vite, tema, login, cargos, layout com sidebar e header, migration completa do banco e a lista de integrações.

**Architecture:** SPA React que fala direto com o Supabase. A sessão e o perfil (com cargo) ficam em um contexto de autenticação; guardas de rota leem esse contexto. Componentes que os testes cobrem dependem só do contexto, nunca do cliente Supabase, para serem testáveis sem rede.

**Tech Stack:** React 18, Vite, TypeScript strict, React Router 6, `@supabase/supabase-js` 2, TanStack React Query 5, CSS Modules, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-08-sistema-single-design.md`

## Global Constraints

- Todos os textos da interface em português.
- TypeScript strict, sem `any`.
- Variáveis de ambiente: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- Nenhum traço ou hífen como separador visual; usar gap, padding, borda ou gradiente.
- Animações com `@keyframes` e transitions nativos; decorativas desligadas sob `prefers-reduced-motion`.
- Tema escuro, destaque `#e63030`.
- Sidebar com 220px, colapsada com 60px.
- Liderança: CEO, Founder, Co-Founder.
- Commits: nenhum durante a execução. Um commit ao final, depois do ok do usuário (o repositório publica na Vercel).

## Review Focus

1. Variável de ambiente preenchida só com espaços: deve contar como ausente e cair na tela "Configuração pendente". Teste na Task 2.
2. Usuário autenticado sem linha em `profiles` (ou com falha ao buscá-la): não pode ficar em carregamento infinito; mostra aviso com botão "Sair". Teste na Task 5.
3. Usuário comum digitando `/app/financeiro` direto na URL: redireciona para o Dashboard com um único toast, mesmo com o efeito disparando duas vezes (StrictMode). Testes nas Tasks 3 e 5.
4. Senha errada no login: mensagem em português, nunca o texto cru do Supabase. Teste na Task 5.
5. Nome vazio ou de uma palavra só no avatar: iniciais com fallback, sem quebrar. Teste na Task 2.

## Estrutura de arquivos

```
index.html, package.json, tsconfig.json, vite.config.ts, vercel.json, .gitignore, .env.example
src/main.tsx                      decide entre ConfiguracaoPendente e App
src/App.tsx                       providers e rotas
src/styles/global.css             tokens, reset, keyframes
src/test/setup.ts                 jest-dom
src/lib/env.ts                    variaveisFaltando()
src/lib/supabase.ts               cliente
src/lib/queryClient.ts            QueryClient
src/lib/datas.ts                  hojeISO, somarDias, diffDias, mesesCompletos
src/lib/formato.ts                formatarMoeda, formatarData, iniciais
src/lib/permissoes.ts             CARGOS, Cargo, isLideranca
src/types/database.ts             tipos das linhas de todas as tabelas
src/components/ui/                Button, Campo, Skeleton, Avatar, Toast, Icone, ui.module.css
src/features/config/ConfiguracaoPendente.tsx
src/features/auth/                AuthContext, AuthProvider, LoginPage, RotaProtegida, RotaLideranca, erros.ts
src/features/placeholder/EmConstrucao.tsx
src/layouts/                      AppLayout, Sidebar, Header, navegacao.ts, layout.module.css
supabase/migrations/0001_schema.sql
docs/INTEGRACOES.md
```

Desvio consciente da spec: Modal, Drawer, Pill, Tooltip e KpiCard entram na etapa 2, junto com a primeira tela que os usa. O sino e os badges são da etapa 3.

---

### Task 1: Projeto base

**Files:** Create `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `vercel.json`, `.gitignore`, `.env.example`, `src/test/setup.ts`, `src/styles/global.css`, `src/main.tsx` (provisório).

**Interfaces:** Produces: scripts `npm run dev`, `npm run build` (`tsc --noEmit && vite build`), `npm test` (`vitest run`); alias `@` para `src`; tokens CSS `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-soft`, `--radius`, `--sidebar-w`, `--sidebar-w-colapsada`; classes globais `fade-up` e `stagger`.

- [ ] Step 1: Escrever os arquivos de configuração e instalar dependências (`react@18 react-dom@18 react-router-dom@6 @supabase/supabase-js @tanstack/react-query`; dev: `vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react@18 @types/react-dom@18`).
- [ ] Step 2: `vercel.json` com rewrite de tudo para `/index.html`.
- [ ] Step 3: `global.css` com tokens, reset, `@keyframes fadeUp`, `shimmer`, `pulse` e o bloco `prefers-reduced-motion`.
- [ ] Step 4: Run `npm run build`. Expected: build conclui sem erros.

### Task 2: Funções puras de `lib`

**Files:** Create `src/lib/env.ts`, `datas.ts`, `formato.ts`, `permissoes.ts` e os respectivos `.test.ts`.

**Interfaces:** Produces:

```ts
// env.ts
export const VARIAVEIS_OBRIGATORIAS: readonly ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']
export function variaveisFaltando(env: Record<string, unknown>): string[]
// datas.ts (datas são strings 'AAAA-MM-DD')
export function hojeISO(agora?: Date): string
export function somarDias(iso: string, dias: number): string
export function diffDias(deISO: string, ateISO: string): number   // ate menos de
export function mesesCompletos(inicioISO: string, fimISO: string): number  // nunca negativo
// formato.ts
export function formatarMoeda(valor: number): string
export function formatarData(iso: string | null | undefined): string  // dd/mm/aaaa ou ''
export function iniciais(nome: string | null | undefined): string     // até 2 letras, '?' se vazio
// permissoes.ts
export const CARGOS: readonly [...]
export type Cargo = (typeof CARGOS)[number]
export function isLideranca(cargo: Cargo | null | undefined): boolean
```

- [ ] Step 1: Escrever os testes.

```ts
// env.test.ts
expect(variaveisFaltando({})).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
expect(variaveisFaltando({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: '   ' })).toEqual(['VITE_SUPABASE_ANON_KEY'])
expect(variaveisFaltando({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual([])

// datas.test.ts
expect(hojeISO(new Date(2026, 9, 8, 23, 30))).toBe('2026-10-08')
expect(somarDias('2026-10-30', 2)).toBe('2026-11-01')
expect(somarDias('2026-12-31', 2)).toBe('2027-01-02')
expect(diffDias('2026-10-01', '2026-10-08')).toBe(7)
expect(diffDias('2026-10-08', '2026-10-01')).toBe(-7)
expect(mesesCompletos('2026-01-15', '2026-10-14')).toBe(8)
expect(mesesCompletos('2026-01-15', '2026-10-15')).toBe(9)
expect(mesesCompletos('2025-10-08', '2026-10-08')).toBe(12)
expect(mesesCompletos('2026-12-01', '2026-10-08')).toBe(0)

// formato.test.ts
expect(formatarMoeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50')
expect(formatarData('2026-10-08')).toBe('08/10/2026')
expect(formatarData(null)).toBe('')
expect(iniciais('Luan Uliana')).toBe('LU')
expect(iniciais('  maria da silva souza ')).toBe('MS')
expect(iniciais('Single')).toBe('S')
expect(iniciais('')).toBe('?')
expect(iniciais(null)).toBe('?')

// permissoes.test.ts
for (const c of ['CEO', 'Founder', 'Co-Founder'] as const) expect(isLideranca(c)).toBe(true)
for (const c of ['Gestor de Tráfego', 'Social Media', 'Designer', 'Editor de Vídeo', 'Copywriter'] as const) expect(isLideranca(c)).toBe(false)
expect(isLideranca(null)).toBe(false)
```

- [ ] Step 2: Run `npm test`. Expected: FAIL (módulos inexistentes).
- [ ] Step 3: Implementar. `diffDias` usa `Date.UTC` para não sofrer com horário de verão.
- [ ] Step 4: Run `npm test`. Expected: PASS.

### Task 3: Componentes de UI

**Files:** Create `src/components/ui/Button.tsx`, `Campo.tsx`, `Skeleton.tsx`, `Avatar.tsx`, `Icone.tsx`, `Toast.tsx`, `ui.module.css`, `Toast.test.tsx`.

**Interfaces:** Consumes `iniciais`. Produces:

```ts
<Button variante?: 'primario' | 'secundario' | 'fantasma' carregando?: boolean {...button props} />
<Campo rotulo: string erro?: string {...input props} />
<Skeleton largura?: string altura?: string raio?: string />
<Avatar nome: string | null url?: string | null tamanho?: number />
<Icone nome: NomeIcone tamanho?: number />
<ToastProvider>; useToast(): { sucesso(msg: string): void; erro(msg: string): void }
```

- [ ] Step 1: Teste do Toast.

```tsx
// mostra a mensagem com role="status"; some após 4s (fake timers)
// duas chamadas de erro('Acesso não autorizado.') seguidas resultam em um único toast visível
```

- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implementar os componentes. O provider ignora uma mensagem idêntica (mesmo tipo e texto) enquanto a anterior está visível.
- [ ] Step 4: Run `npm test`. Expected: PASS.

### Task 4: Banco e tipos

**Files:** Create `supabase/migrations/0001_schema.sql`, `src/types/database.ts`.

**Interfaces:** Produces as interfaces `Profile`, `Client`, `ClientPayment`, `Task`, `ContentCard`, `Campaign`, `CampaignTask`, `Expense`, `MonthlyGoal`, `TrafficMetric`, `ActivityLog` e os tipos de união de status, com os nomes de coluna da seção 6 da spec.

- [ ] Step 1: Migration com as 11 tabelas, `check` nos campos de status, índices nas chaves estrangeiras, `private.is_lideranca()`, trigger `handle_new_user`, trigger que protege `cargo`, RLS conforme a spec e os buckets `logos` e `avatars` com suas políticas.
- [ ] Step 2: Tipos TypeScript espelhando as tabelas.
- [ ] Step 3: Run `npm run build`. Expected: sem erros de tipo. A migration é aplicada quando o projeto Supabase estiver conectado (ver `docs/INTEGRACOES.md`).

### Task 5: Autenticação e guardas

**Files:** Create `src/lib/supabase.ts`, `src/lib/queryClient.ts`, `src/features/config/ConfiguracaoPendente.tsx` (+ teste), `src/features/auth/AuthContext.tsx`, `AuthProvider.tsx`, `LoginPage.tsx`, `RotaProtegida.tsx`, `RotaLideranca.tsx`, `erros.ts`, `auth.module.css`, `erros.test.ts`, `rotas.test.tsx`.

**Interfaces:** Consumes `Profile`, `isLideranca`, `useToast`, `variaveisFaltando`. Produces:

```ts
export interface AuthValor {
  sessao: Session | null
  perfil: Profile | null
  carregando: boolean
  erroPerfil: boolean
  sair: () => Promise<void>
}
export const AuthContext: React.Context<AuthValor | null>
export function useAuth(): AuthValor
export function traduzirErroAuth(mensagem: string | undefined): string
<ConfiguracaoPendente faltando: string[] />
<RotaProtegida />   // usa <Outlet />
<RotaLideranca />   // usa <Outlet />
```

- [ ] Step 1: Escrever os testes.

```ts
// erros.test.ts
expect(traduzirErroAuth('Invalid login credentials')).toBe('E-mail ou senha incorretos.')
expect(traduzirErroAuth('Email not confirmed')).toBe('Confirme seu e-mail antes de entrar.')
expect(traduzirErroAuth('Failed to fetch')).toBe('Sem conexão com o servidor. Tente novamente.')
expect(traduzirErroAuth('qualquer outra coisa')).toBe('Não foi possível entrar. Tente novamente.')
expect(traduzirErroAuth(undefined)).toBe('Não foi possível entrar. Tente novamente.')
```

```tsx
// rotas.test.tsx: monta MemoryRouter com AuthContext.Provider falso e ToastProvider
// sem sessão em /app/dashboard            -> mostra a tela de login
// sessão sem perfil (erroPerfil ou null)  -> mostra "Não encontramos seu perfil" e o botão Sair chama sair()
// carregando                              -> não mostra login nem conteúdo
// Designer em /app/financeiro             -> mostra Dashboard e um único toast "Acesso não autorizado."
// CEO em /app/financeiro                  -> mostra o conteúdo do Financeiro
// ConfiguracaoPendente.test.tsx: lista exatamente as variáveis recebidas
```

- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implementar. `AuthProvider` lê a sessão com `getSession` e `onAuthStateChange`, busca o perfil com React Query (`['perfil', userId]`, `maybeSingle`). `LoginPage` usa `signInWithPassword` e redireciona quem já tem sessão.
- [ ] Step 4: Run `npm test`. Expected: PASS.

### Task 6: Layout e rotas

**Files:** Create `src/layouts/navegacao.ts`, `Sidebar.tsx`, `Header.tsx`, `AppLayout.tsx`, `layout.module.css`, `navegacao.test.ts`, `Sidebar.test.tsx`, `src/features/placeholder/EmConstrucao.tsx`, `src/App.tsx`. Modify `src/main.tsx`.

**Interfaces:** Consumes `useAuth`, `isLideranca`, `Avatar`, `Icone`. Produces:

```ts
export interface ItemNav { rota: string; rotulo: string; icone: NomeIcone; apenasLideranca?: boolean }
export const ITENS_NAV: readonly ItemNav[]
export function itensVisiveis(cargo: Cargo | null | undefined): ItemNav[]
export function tituloDaRota(pathname: string): string
```

- [ ] Step 1: Escrever os testes.

```ts
// navegacao.test.ts
expect(itensVisiveis('Designer').map(i => i.rotulo)).toEqual(['Dashboard','Clientes','Demandas','Conteúdo','Campanhas','Configurações'])
expect(itensVisiveis('CEO').map(i => i.rotulo)).toEqual(['Dashboard','Clientes','Demandas','Conteúdo','Campanhas','Financeiro','Configurações'])
expect(tituloDaRota('/app/campanhas/123')).toBe('Campanhas')
expect(tituloDaRota('/app/qualquer')).toBe('SINGLE')
// Sidebar.test.tsx
// Social Media: não existe link "Financeiro"; rodapé mostra nome e cargo
// Founder: existe link "Financeiro"
// clicar em "Recolher menu" chama onAlternar
```

- [ ] Step 2: Run `npm test`. Expected: FAIL.
- [ ] Step 3: Implementar. Sidebar fixa, 220px ou 60px, estado salvo em `localStorage` com try/catch. Abaixo de 768px vira gaveta aberta pelo botão de menu do header. Rotas: `/login`, `/app/*` sob `RotaProtegida` e `AppLayout`, `/app/financeiro/:aba?` sob `RotaLideranca`, qualquer outra rota vai para `/app/dashboard`. `main.tsx` mostra `ConfiguracaoPendente` se faltar variável e só então carrega `App` com import dinâmico.
- [ ] Step 4: Run `npm test`. Expected: PASS.

### Task 7: Documentação e verificação final

**Files:** Create `docs/INTEGRACOES.md`.

- [ ] Step 1: Checklist por sistema (Supabase, GitHub, Vercel, Resend) com o que já está feito e o passo a passo do que falta, incluindo como criar o primeiro usuário e marcá-lo como CEO.
- [ ] Step 2: Run `npm test` e `npm run build`. Expected: tudo verde.
- [ ] Step 3: Run `npm run dev` sem `.env` e abrir no navegador. Expected: tela "Configuração pendente" listando as duas variáveis.
