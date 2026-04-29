# Frontend API Contract — RECIX Engine MVP

Base URL: `VITE_API_BASE_URL` (default: `http://localhost:5000`)

---

## Tipos TypeScript

```typescript
// src/types/index.ts

export type ChargeStatus = 'Pending' | 'Paid' | 'Expired' | 'Divergent' | 'Cancelled'
export type PaymentEventStatus = 'Received' | 'Processing' | 'Processed' | 'Failed' | 'IgnoredDuplicate'
export type ReconciliationStatus =
  | 'Matched'
  | 'AmountMismatch'
  | 'DuplicatePayment'
  | 'PaymentWithoutCharge'
  | 'ExpiredChargePaid'
  | 'InvalidReference'
  | 'ProcessingError'

export interface Charge {
  id: string
  referenceId: string
  externalId: string
  amount: number
  status: ChargeStatus
  expiresAt: string       // ISO 8601
  createdAt: string
  updatedAt: string | null
}

export interface PaymentEvent {
  id: string
  eventId: string
  externalChargeId: string | null
  referenceId: string | null
  paidAmount: number
  paidAt: string
  provider: string
  status: PaymentEventStatus
  createdAt: string
  processedAt: string | null
}

export interface ReconciliationResult {
  id: string
  chargeId: string | null
  paymentEventId: string
  status: ReconciliationStatus
  reason: string
  expectedAmount: number | null
  paidAmount: number
  createdAt: string
}

export interface DashboardSummary {
  totalCharges: number
  paidCharges: number
  pendingCharges: number
  divergentCharges: number
  expiredCharges: number
  totalReceivedAmount: number
  totalDivergentAmount: number
  reconciliationIssues: {
    amountMismatch: number
    duplicatePayment: number
    paymentWithoutCharge: number
    expiredChargePaid: number
    invalidReference: number
    processingError: number
  }
}

export interface FluxPoint {
  label: string
  received: number
  expected: number
  divergent: number
}

export interface RecentReconciliation {
  id: string
  status: ReconciliationStatus
  reason: string
  expectedAmount: number | null
  paidAmount: number
  chargeReferenceId: string | null
  paymentEventId: string
  createdAt: string
}

export interface RecentPaymentEvent {
  eventId: string
  referenceId: string | null
  paidAmount: number
  provider: string
  status: PaymentEventStatus
  paidAt: string
  processedAt: string | null
}

export interface DashboardAlert {
  type: 'amountMismatch' | 'duplicatePayment' | 'paymentWithoutCharge'
  count: number
  lastDetectedAt: string
  description: string
  routeStatus: ReconciliationStatus
}

export interface DashboardOverview {
  updatedAt: string
  summary: DashboardSummary
  previousPeriodSummary: DashboardSummary
  fluxSeries: FluxPoint[]
  recentReconciliations: RecentReconciliation[]
  recentPaymentEvents: RecentPaymentEvent[]
  alerts: DashboardAlert[]
}

export interface AiExplanation {
  reconciliationId: string
  explanation: string
  generatedAt: string
  model: string
}

export interface AiDailySummary {
  date: string
  summary: string
  generatedAt: string
  model: string
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

// Request types
export interface CreateChargeRequest {
  amount: number
  expiresInMinutes: number
}

export interface SendWebhookRequest {
  eventId: string
  externalChargeId?: string
  referenceId?: string
  paidAmount: number
  paidAt: string
  provider: string
}

export interface SendWebhookResponse {
  received: boolean
  eventId: string
  status: 'Received' | 'IgnoredDuplicate'
}
```

---

## Endpoints Consumidos

### GET /dashboard/summary

```typescript
// dashboardService.getSummary()
Response: DashboardSummary
Status: 200
```

Exemplo de response:
```json
{
  "totalCharges": 10,
  "paidCharges": 7,
  "pendingCharges": 2,
  "divergentCharges": 1,
  "expiredCharges": 0,
  "totalReceivedAmount": 1050.25,
  "totalDivergentAmount": 200.00,
  "reconciliationIssues": {
    "amountMismatch": 1,
    "duplicatePayment": 0,
    "paymentWithoutCharge": 0,
    "expiredChargePaid": 0,
    "invalidReference": 0,
    "processingError": 0
  }
}
```

---

### GET /dashboard/overview

```typescript
// dashboardService.getOverview(params)
// params: { fromDate?: string, toDate?: string }
Response: DashboardOverview
Status: 200
```

Exemplo de response:
```json
{
  "updatedAt": "2026-04-29T00:20:00Z",
  "summary": {},
  "previousPeriodSummary": {},
  "fluxSeries": [],
  "recentReconciliations": [],
  "recentPaymentEvents": [],
  "alerts": []
}
```

---

### GET /charges

```typescript
// chargesService.list(params)
Params: { status?: ChargeStatus, fromDate?: string, toDate?: string, page?: number, pageSize?: number }
Response: PagedResult<Charge>
Status: 200
```

---

### GET /charges/:id

```typescript
// chargesService.getById(id)
Response: Charge
Status: 200 | 404
```

---

### POST /charges

```typescript
// chargesService.create(data)
Body: CreateChargeRequest
Response: Charge (status 201)
Error 400: { type, title, errors }
```

Exemplo de request:
```json
{ "amount": 150.75, "expiresInMinutes": 30 }
```

---

### GET /payment-events

```typescript
// paymentEventsService.list(params)
Params: { status?: PaymentEventStatus, page?: number, pageSize?: number }
Response: PagedResult<PaymentEvent>
Status: 200
```

---

### GET /reconciliations

```typescript
// reconciliationsService.list(params)
Params: { status?: ReconciliationStatus, chargeId?: string, paymentEventId?: string, page?: number, pageSize?: number }
Response: PagedResult<ReconciliationResult>
Status: 200
```

---

### POST /webhooks/pix

```typescript
// webhooksService.sendPixWebhook(data)
Body: SendWebhookRequest
Response: SendWebhookResponse (202 ou 200)
Error 400: { type, title }
```

Exemplo de request:
```json
{
  "eventId": "evt_abc123",
  "externalChargeId": "fakepsp_xxx",
  "paidAmount": 150.75,
  "paidAt": "2026-04-29T10:00:00Z",
  "provider": "FakePixProvider"
}
```

---

### GET /ai/reconciliations/:id/explanation

```typescript
// aiService.explainReconciliation(id)
Response: AiExplanation
Status: 200 | 404
```

---

### GET /ai/summary/daily

```typescript
// aiService.getDailySummary(date?)
Params: { date?: string }  // yyyy-MM-dd
Response: AiDailySummary
Status: 200
```

---

## Status Codes Relevantes

| Code | Tratamento |
|------|-----------|
| 200 | Sucesso |
| 201 | Criado — mostrar toast de sucesso |
| 202 | Aceito (webhook) — mostrar feedback |
| 400 | Validação — mostrar errors do body |
| 404 | Não encontrado — ErrorState com mensagem |
| 500 | Erro interno — ErrorState genérico |
| Network error | API fora — ErrorState com "API indisponível" |

---

## Estratégia de Fallback

Se `VITE_API_BASE_URL` não estiver configurada:
- Usar `http://localhost:5000` como default em `src/config/env.ts`

Se a API retornar erro de rede:
- `ErrorState` com mensagem: *"Não foi possível conectar à API. Verifique se o backend está rodando."*
- Botão "Tentar novamente" que chama `refetch()`

Se a API retornar 404:
- Mensagem específica: *"Recurso não encontrado."*

Se a API retornar 400:
- Exibir `errors` do body como lista dentro do formulário

---

## Variáveis de Ambiente

```env
# .env
VITE_API_BASE_URL=http://localhost:5000

# .env.example (commitado no repositório)
VITE_API_BASE_URL=http://localhost:5000
```

Acesso em código:
```typescript
// src/config/env.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000'
```
