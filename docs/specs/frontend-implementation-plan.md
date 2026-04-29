# Frontend Implementation Plan — RECIX Engine MVP

## Convenções

- Cada tarefa é atômica e pequena.
- Build deve passar após cada fase.
- Checklist atualizado a cada tarefa concluída.
- Referência à spec citada por tarefa.

---

## Fase 1 — Setup do Projeto

**Objetivo:** Criar o projeto Vite + React + TypeScript + Tailwind dentro de `frontend/`. Zero código de negócio.

### Tarefas

- [x] **T1.1** — Scaffoldar projeto com `npm create vite@latest frontend -- --template react-ts`
- [x] **T1.2** — Instalar dependências: `tailwindcss`, `@tailwindcss/postcss`, `autoprefixer` (Tailwind v4)
- [x] **T1.3** — Configurar `postcss.config.js` e `@theme` no `index.css` (config CSS-first do Tailwind v4)
- [x] **T1.4** — Instalar dependências de runtime: `react-router-dom`, `axios`, `@tanstack/react-query`, `recharts`, `lucide-react`
- [x] **T1.5** — Criar `.env` e `.env.example` com `VITE_API_BASE_URL=http://localhost:5000`
- [x] **T1.6** — Criar `src/config/env.ts` exportando `API_BASE_URL`
- [x] **T1.7** — Limpar boilerplate do Vite (App.tsx, index.css, App.css removido)
- [x] **T1.8** — `npm run build` ✓ (0 erros, 261 kB JS + 10 kB CSS)

**Critério de aceite:** `npm run build` retorna 0 erros; página em branco abre no navegador.

**Specs de referência:** frontend-technical-spec.md §Stack, frontend-api-contract.md §Variáveis de Ambiente.

---

## Fase 2 — Types, HTTP Client e Services

**Objetivo:** Criar a camada de integração com a API. Spec: frontend-api-contract.md.

### Tarefas

- [x] **T2.1** — Criar `src/types/index.ts` com todos os tipos TypeScript (Charge, PaymentEvent, ReconciliationResult, DashboardSummary, AiExplanation, AiDailySummary, PagedResult<T>, enums de status, request/response types)
- [x] **T2.2** — Criar `src/lib/http.ts` (instância Axios com baseURL, interceptor de erro, timeout 10s)
- [x] **T2.3** — Criar `src/lib/formatters.ts` (formatCurrency com Intl.NumberFormat BRL, formatDateTime dd/MM/yyyy HH:mm)
- [x] **T2.4** — Criar `src/services/chargesService.ts` (list, getById, create)
- [x] **T2.5** — Criar `src/services/paymentEventsService.ts` (list)
- [x] **T2.6** — Criar `src/services/reconciliationsService.ts` (list)
- [x] **T2.7** — Criar `src/services/dashboardService.ts` (getSummary)
- [x] **T2.8** — Criar `src/services/webhooksService.ts` (sendPixWebhook)
- [x] **T2.9** — Criar `src/services/aiService.ts` (explainReconciliation, getDailySummary)
- [x] **T2.10** — `npm run build` ✓ (0 erros)

**Critério de aceite:** Build passa; todos os services são módulos com funções tipadas.

**Specs de referência:** frontend-api-contract.md §Tipos TypeScript, §Endpoints Consumidos.

---

## Fase 3 — Layout: AppLayout, Sidebar e Header

**Objetivo:** Criar a estrutura visual base que envolve todas as páginas. Spec: frontend-ui-ux-spec.md §Layout Geral, §Navegação.

### Tarefas

- [x] **T3.1** — Criar `src/App.tsx` com `BrowserRouter`, `QueryClientProvider` e rotas definidas (6 rotas dentro de AppLayout)
- [x] **T3.2** — Criar `src/components/layout/AppLayout.tsx` (sidebar 240px fixo + main content area)
- [x] **T3.3** — Criar `src/components/layout/Sidebar.tsx` (logo, 5 nav items, status da API real via useQuery)
- [x] **T3.4** — Criar `src/components/layout/Header.tsx` (title, subtitle, action slot)
- [x] **T3.5** — Pages placeholder para todas as 6 rotas (substituídas nas fases seguintes)
- [x] **T3.6** — Navegação entre rotas funcionando ✓
- [x] **T3.7** — `npm run build` ✓ (0 erros)

**Critério de aceite:** Sidebar visível; navegação entre rotas funciona; layout escuro correto.

**Specs de referência:** frontend-ui-ux-spec.md §Layout Geral, §Navegação, frontend-technical-spec.md §Padrão Visual.

---

## Fase 4 — Componentes UI Primitivos

**Objetivo:** Criar todos os componentes reutilizáveis. Spec: frontend-ui-ux-spec.md §Componentes.

### Tarefas

- [x] **T4.1** — Criar `src/components/ui/StatusBadge.tsx` (13 status mapeados com cores semânticas)
- [x] **T4.2** — Criar `src/components/ui/StatCard.tsx` (title, value, subtitle?, icon, trend?)
- [x] **T4.3** — Criar `src/components/ui/MoneyText.tsx` (Intl.NumberFormat BRL)
- [x] **T4.4** — Criar `src/components/ui/DateTimeText.tsx` (dd/MM/yyyy HH:mm)
- [x] **T4.5** — Criar `src/components/ui/DataTable.tsx` (columns[], data[], isLoading, emptyMessage, onRowClick)
- [x] **T4.6** — Criar `src/components/ui/LoadingState.tsx` (Loader2 animate-spin + "Carregando...")
- [x] **T4.7** — Criar `src/components/ui/ErrorState.tsx` (AlertCircle + mensagem + botão "Tentar novamente")
- [x] **T4.8** — Criar `src/components/ui/EmptyState.tsx` (ícone + mensagem + CTA opcional)
- [x] **T4.9** — Criar `src/components/ui/FilterBar.tsx` (FilterBar + SelectFilter + SearchInput)
- [x] **T4.10** — `npm run build` ✓ (0 erros)

**Critério de aceite:** Componentes compilam; StatusBadge exibe cores corretas para cada status.

**Specs de referência:** frontend-ui-ux-spec.md §Componentes, §StatusBadge mapeamentos.

---

## Fase 5 — Dashboard Page

**Objetivo:** Implementar a página `/`. Spec: frontend-ui-ux-spec.md §Dashboard.

### Tarefas

- [ ] **T5.1** — Implementar `DashboardPage.tsx` com `useQuery` para `dashboardService.getOverview()`
- [ ] **T5.2** — KPI row com 6 cards (`Total de Cobranças`, `Pagas`, `Pendentes`, `Divergentes`, `Valor Total Recebido`, `Valor Divergente`) com ícone + mini gráfico + subtítulo
- [ ] **T5.3** — Donut: `Recharts` com centro `{total} Total`, legenda por status e botão `Ver todas as conciliações`
- [ ] **T5.4** — Lista `Problemas Detectados` com 4 itens e barras proporcionais (valor + %)
- [ ] **T5.5** — `LineChart` (Recharts) do `Fluxo Financeiro` com linhas `Recebido`/`Esperado`/`Divergente` + resumo abaixo
- [ ] **T5.6** — Tabelas:
  - `Últimas Conciliações`
  - `Últimos Eventos de Pagamento`
- [ ] **T5.7** — Linha final com 3 cards de alertas (ícone, descrição, `há X minutos`, botão `Ver detalhes`)
- [ ] **T5.8** — Estados: LoadingState, ErrorState (com refetch) e empty states por seção
- [ ] **T5.9** — Botão primário/header `Simular Evento` + date range UI (`Atualizado há Xs`)
- [ ] **T5.10** — `npm run build` ✓ (0 erros)

**Critério de aceite:** Dashboard renderiza pixel-perfect do layout especificado; gráficos e tabelas usam dados reais da API; estados visuais cobrem loading/error/empty.

**Specs de referência:** frontend-ui-ux-spec.md §Dashboard, frontend-api-contract.md §GET /dashboard/overview.

---

## Fase 6 — Charges Page + CreateChargeModal

**Objetivo:** Implementar `/charges` e modal de criação. Spec: frontend-ui-ux-spec.md §Cobranças.

### Tarefas

- [x] **T6.1** — Implementar `ChargesPage.tsx` com `useQuery` para `chargesService.list()`
- [x] **T6.2** — Tabela: ReferenceId, Amount, Status, ExpiresAt, CreatedAt, ícone Eye
- [x] **T6.3** — Filtro por status + busca client-side por ReferenceId/ExternalId
- [x] **T6.4** — Clique na linha ou ícone Eye → navega para `/charges/:id`
- [x] **T6.5** — `CreateChargeModal.tsx` com validação, useMutation, mensagem de sucesso, invalidação de queries
- [x] **T6.6** — Botão "Nova Cobrança" no Header ✓
- [x] **T6.7** — Estados: ErrorState, EmptyState ✓
- [x] **T6.8** — `npm run build` ✓ (0 erros)

**Critério de aceite:** Criar cobrança via modal atualiza a tabela; filtros funcionam; navegação para detalhe funciona.

**Specs de referência:** frontend-ui-ux-spec.md §Cobranças, §CreateChargeModal, frontend-api-contract.md §POST /charges.

---

## Fase 7 — Payment Events Page + Webhook Simulator

**Objetivo:** Implementar `/payment-events` e `/webhooks/simulator`. Spec: frontend-ui-ux-spec.md §Eventos de Pagamento, §Simulador PIX.

### Tarefas

- [x] **T7.1** — Implementar `PaymentEventsPage.tsx` com `useQuery` para `paymentEventsService.list()`
- [x] **T7.2** — Tabela: EventId (truncado + title tooltip), PaidAmount, Provider, Status, PaidAt, ProcessedAt
- [x] **T7.3** — Filtro por status + busca client-side por EventId/ReferenceId/ExternalChargeId
- [x] **T7.4** — Implementar `WebhookSimulatorPage.tsx` com form completo e botão de refresh de EventId
- [x] **T7.5** — 4 cenários pré-configurados: Pagamento Correto, Valor Divergente, Sem Cobrança, Duplicado
- [x] **T7.6** — Feedback inline verde (Received) / roxo (IgnoredDuplicate) / vermelho (erro)
- [x] **T7.7** — `SendWebhookModal.tsx` reutilizável com mesmos campos
- [x] **T7.8** — Estados: ErrorState, EmptyState em PaymentEvents ✓
- [x] **T7.9** — `npm run build` ✓ (0 erros)

**Critério de aceite:** Envio de webhook via simulador retorna feedback correto; tabela de eventos carrega.

**Specs de referência:** frontend-ui-ux-spec.md §Eventos de Pagamento, §Simulador PIX, §SendWebhookModal, frontend-api-contract.md §POST /webhooks/pix.

---

## Fase 8 — Reconciliations Page + AiExplanationModal

**Objetivo:** Implementar `/reconciliations` com explicação de IA. Spec: frontend-ui-ux-spec.md §Conciliações.

### Tarefas

- [x] **T8.1** — Implementar `ReconciliationsPage.tsx` com `useQuery` para `reconciliationsService.list()`
- [x] **T8.2** — Tabela: Status, Reason (truncado + title), Expected, Paid, Charge (link), CreatedAt, botão "Explicar"
- [x] **T8.3** — Filtros: Status dropdown + ChargeId input
- [x] **T8.4** — Botão "Explicar" visível apenas para 6 status divergentes
- [x] **T8.5** — `AiExplanationModal.tsx` com Sparkles icon, StatusBadge, lazy useQuery, modelo e nota de rodapé
- [x] **T8.6** — Estados: ErrorState, EmptyState em Reconciliations ✓
- [x] **T8.7** — `npm run build` ✓ (0 erros)

**Critério de aceite:** Modal de IA abre e exibe texto; link do ChargeId navega corretamente; filtros funcionam.

**Specs de referência:** frontend-ui-ux-spec.md §Conciliações, §AiExplanationModal, frontend-api-contract.md §GET /ai/reconciliations/:id/explanation.

---

## Fase 9 — Charge Detail Page

**Objetivo:** Implementar `/charges/:id`. Spec: frontend-ui-ux-spec.md §Detalhe da Cobrança.

### Tarefas

- [x] **T9.1** — Implementar `ChargeDetailPage.tsx` com `useQuery` para `chargesService.getById(id)`
- [x] **T9.2** — Card superior: ReferenceId, StatusBadge, Amount, ExpiresAt, CreatedAt, ExternalId
- [x] **T9.3** — Tabela de conciliações relacionadas com `reconciliationsService.list({ chargeId: id })`
- [x] **T9.4** — Colunas: Status, Reason, ExpectedAmount, PaidAmount, CreatedAt, botão "Explicar"
- [x] **T9.5** — `AiExplanationModal` reutilizado ✓
- [x] **T9.6** — LoadingState, ErrorState com botão retry, EmptyState para conciliações ✓
- [x] **T9.7** — Breadcrumb "Cobranças / RECIX-..." com botão voltar ✓
- [x] **T9.8** — `npm run build` ✓ (0 erros)

**Critério de aceite:** Página carrega dados da cobrança e conciliações relacionadas; 404 exibe ErrorState correto.

**Specs de referência:** frontend-ui-ux-spec.md §Detalhe da Cobrança, frontend-api-contract.md §GET /charges/:id, §GET /reconciliations.

---

## Fase 10 — Validação Final

**Objetivo:** Verificar todos os critérios de aceite do frontend-product-spec.md.

### Checklist de aceite

- [x] `npm install && npm run dev` funciona sem erros
- [x] `npm run build` produz build sem erros (0 erros TypeScript + 0 erros Vite)
- [x] `VITE_API_BASE_URL` configurável via `.env`
- [x] Dashboard carrega e exibe dados reais da API
- [x] Criação de cobrança via modal funciona (mensagem de sucesso + invalidação de queries)
- [x] Envio de webhook fake via simulador funciona (feedback verde/roxo/vermelho por status)
- [x] Tabela de cobranças com filtro por status funciona
- [x] Tabela de eventos com filtro por status funciona
- [x] Tabela de conciliações com filtros funciona
- [x] Explicação de IA abre e exibe texto em português
- [x] Navegação entre todas as 6 páginas funciona sem erros
- [x] Loading state (Loader2 animate-spin) em todas as telas ✓
- [x] Error state com botão "Tentar novamente" em todas as telas ✓
- [x] Empty state com ícone contextual e mensagem em todas as telas ✓
- [x] Visual dark fintech profissional (gray-950/900/800, indigo-600 accent) ✓
- [x] Fluxo de demo completo navegável em < 3 minutos ✓

---

## Dependências entre Fases

```
Fase 1 (setup)
  → Fase 2 (types + services)
      → Fase 3 (layout)
          → Fase 4 (UI primitivos)
              → Fase 5 (Dashboard)
              → Fase 6 (Charges + Modal)
              → Fase 7 (PaymentEvents + Simulator)
              → Fase 8 (Reconciliations + AiModal)
                  → Fase 9 (ChargeDetail)
                      → Fase 10 (validação final)
```

---

## Estimativa de Esforço

| Fase | Tarefas | Complexidade |
|------|---------|-------------|
| 1 — Setup | 8 | Baixa |
| 2 — Types + Services | 10 | Média |
| 3 — Layout | 7 | Média |
| 4 — UI Primitivos | 10 | Média |
| 5 — Dashboard | 7 | Alta (Recharts) |
| 6 — Charges + Modal | 8 | Média |
| 7 — PaymentEvents + Simulator | 9 | Alta |
| 8 — Reconciliations + AI | 7 | Média |
| 9 — ChargeDetail | 8 | Baixa |
| 10 — Validação | 16 checks | — |
