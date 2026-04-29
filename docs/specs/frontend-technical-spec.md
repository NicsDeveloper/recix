# Frontend Technical Spec — RECIX Engine MVP

## Stack

| Camada | Tecnologia | Versão alvo |
|--------|-----------|-------------|
| Framework | React | 18+ |
| Linguagem | TypeScript | 5+ |
| Build tool | Vite | 5+ |
| Estilo | Tailwind CSS | 3+ |
| Roteamento | React Router DOM | 6+ |
| HTTP client | Axios | 1+ |
| Gráficos | Recharts | 2+ |
| Ícones | Lucide React | 0.400+ |
| State/cache | TanStack Query (React Query) | 5+ |

---

## Estrutura de Pastas

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── ui/
│   │   │   ├── StatCard.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── DataTable.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── MoneyText.tsx
│   │   │   ├── DateTimeText.tsx
│   │   │   └── FilterBar.tsx
│   │   └── modals/
│   │       ├── CreateChargeModal.tsx
│   │       ├── SendWebhookModal.tsx
│   │       └── AiExplanationModal.tsx
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── ChargesPage.tsx
│   │   ├── ChargeDetailPage.tsx
│   │   ├── PaymentEventsPage.tsx
│   │   ├── ReconciliationsPage.tsx
│   │   └── WebhookSimulatorPage.tsx
│   ├── services/
│   │   ├── chargesService.ts
│   │   ├── paymentEventsService.ts
│   │   ├── reconciliationsService.ts
│   │   ├── dashboardService.ts
│   │   ├── aiService.ts
│   │   └── webhooksService.ts
│   ├── types/
│   │   └── index.ts
│   ├── lib/
│   │   ├── http.ts
│   │   └── formatters.ts
│   ├── config/
│   │   └── env.ts
│   ├── hooks/
│   │   └── useAutoRefresh.ts
│   ├── App.tsx
│   └── main.tsx
├── .env
├── .env.example
├── index.html
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

---

## Estratégia de Rotas

```
/                         → DashboardPage
/charges                  → ChargesPage
/charges/:id              → ChargeDetailPage
/payment-events           → PaymentEventsPage
/reconciliations          → ReconciliationsPage
/webhooks/simulator       → WebhookSimulatorPage
```

Todas as rotas são envoltas por `AppLayout` que contém a sidebar e o header.

---

## Estratégia de Chamadas HTTP

### Client centralizado (`src/lib/http.ts`)
- Instância única de Axios com `baseURL` lida de `env.ts`
- Interceptor de response para tratamento de erros padronizado
- Timeout padrão: 10 segundos

### Services (`src/services/`)
- Cada service é um módulo com funções puras
- Retornam types fortes definidos em `src/types/index.ts`
- Não fazem setState — apenas retornam dados
- Lançam erros tipados em caso de falha

### TanStack Query
- `useQuery` para dados de leitura (GET)
- `useMutation` para criação/envio (POST)
- Stale time: 30 segundos para dashboard e listas
- Invalidação explícita após mutations bem-sucedidas

---

## Modelagem de Types

Definidos em `src/types/index.ts`:

```typescript
// Enums de status
type ChargeStatus = 'Pending' | 'Paid' | 'Expired' | 'Divergent' | 'Cancelled'
type PaymentEventStatus = 'Received' | 'Processing' | 'Processed' | 'Failed' | 'IgnoredDuplicate'
type ReconciliationStatus = 'Matched' | 'AmountMismatch' | 'DuplicatePayment' | 'PaymentWithoutCharge' | 'ExpiredChargePaid' | 'InvalidReference' | 'ProcessingError'

// Entidades
interface Charge { ... }
interface PaymentEvent { ... }
interface ReconciliationResult { ... }
interface DashboardSummary { ... }
interface AiExplanation { ... }

// Paginação
interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}
```

---

## Tratamento de Loading / Error / Empty States

Toda tela/seção que consome API deve ter 3 estados visuais:

| Estado | Componente | Comportamento |
|--------|-----------|---------------|
| Loading | `LoadingState` | Skeleton ou spinner centralizado |
| Error | `ErrorState` | Mensagem + botão "Tentar novamente" |
| Empty | `EmptyState` | Ícone + mensagem contextual |

Padrão com TanStack Query:
```tsx
if (isLoading) return <LoadingState />
if (isError) return <ErrorState onRetry={refetch} />
if (!data?.items.length) return <EmptyState message="..." />
return <DataTable ... />
```

---

## Padrão Visual

### Tema: escuro (dark)
- Background principal: `gray-950` / `gray-900`
- Superfícies de cards: `gray-900` / `gray-800`
- Bordas: `gray-700` / `gray-800`
- Texto primário: `gray-50`
- Texto secundário: `gray-400`
- Accent: `indigo-500` (ações primárias)

### Tipografia
- Fonte: Inter (via CDN Google Fonts ou Tailwind default)
- Tamanhos: sm (12px), base (14px), lg (16px), xl (20px), 2xl (24px)

### Espaçamento
- Grid de 8px (Tailwind default)
- Padding de cards: `p-6`
- Gap entre cards: `gap-4` ou `gap-6`

### Componentes-base
- Todos os cards: `rounded-xl border border-gray-800 bg-gray-900`
- Botão primário: `bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2`
- Botão secundário: `border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg px-4 py-2`
- Input: `bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2`

---

## Estratégia de Responsividade

Foco em **desktop/tablet** (mínimo 1024px).

- Sidebar: fixa no desktop, colapsável em mobile
- Cards do dashboard: grid responsivo `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Tabelas: scroll horizontal em telas menores (`overflow-x-auto`)
- Modais: `max-w-lg` centralizado

Mobile (< 768px) terá usabilidade básica, mas não é prioridade do MVP.

---

## Integração com Backend

```
API base URL: http://localhost:5000 (configurável via VITE_API_BASE_URL)
```

A API backend já está rodando via `docker compose up`.

O frontend se comunica diretamente com a API — sem BFF, sem proxy no MVP.

Para desenvolvimento local com a API rodando em Docker:
```env
VITE_API_BASE_URL=http://localhost:5000
```

---

## Riscos Técnicos

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| CORS bloqueando chamadas | Média | Configurar `AllowAnyOrigin` na API .NET (já presente em Development) |
| API fora do ar durante demo | Baixa | ErrorState com botão de retry em todas as telas |
| Dados desatualizados no dashboard | Média | Auto-refresh opcional a cada 10s via `useAutoRefresh` hook |
| Paginação não implementada no backend para grandes volumes | Baixa | `pageSize=100` como padrão nos requests do MVP |
| Tipo `null` em campos opcionais da API | Alta | Tipos TypeScript com `| null` e guards no render |
