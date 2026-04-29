# API Contract — RECIX Engine MVP

Base URL: `http://localhost:5000`

---

## POST /charges

Cria uma nova cobrança PIX fake.

### Request

```http
POST /charges
Content-Type: application/json
```

```json
{
  "amount": 150.75,
  "expiresInMinutes": 30
}
```

**Validações:**
- `amount`: obrigatório, decimal > 0
- `expiresInMinutes`: obrigatório, inteiro > 0, máximo 1440 (24h)

### Response — 201 Created

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "referenceId": "RECIX-20260429-000001",
  "externalId": "fakepsp_abc123def456",
  "amount": 150.75,
  "status": "Pending",
  "expiresAt": "2026-04-29T00:47:00Z",
  "createdAt": "2026-04-29T00:17:00Z"
}
```

### Response — 400 Bad Request

```json
{
  "type": "ValidationError",
  "title": "One or more validation errors occurred.",
  "errors": {
    "amount": ["Amount must be greater than zero."],
    "expiresInMinutes": ["ExpiresInMinutes must be greater than zero."]
  }
}
```

---

## GET /charges

Lista cobranças com paginação.

### Request

```http
GET /charges?status=Pending&fromDate=2026-04-01&toDate=2026-04-30&page=1&pageSize=20
```

**Query params:**
- `status` (opcional): `Pending` | `Paid` | `Expired` | `Divergent` | `Cancelled`
- `fromDate` (opcional): ISO 8601 date (`yyyy-MM-dd`)
- `toDate` (opcional): ISO 8601 date (`yyyy-MM-dd`)
- `page` (opcional, default: 1): inteiro >= 1
- `pageSize` (opcional, default: 20): inteiro 1–100

### Response — 200 OK

```json
{
  "items": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "referenceId": "RECIX-20260429-000001",
      "externalId": "fakepsp_abc123def456",
      "amount": 150.75,
      "status": "Pending",
      "expiresAt": "2026-04-29T00:47:00Z",
      "createdAt": "2026-04-29T00:17:00Z",
      "updatedAt": null
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 20
}
```

---

## GET /charges/{id}

Retorna detalhes de uma cobrança específica.

### Request

```http
GET /charges/3fa85f64-5717-4562-b3fc-2c963f66afa6
```

### Response — 200 OK

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "referenceId": "RECIX-20260429-000001",
  "externalId": "fakepsp_abc123def456",
  "amount": 150.75,
  "status": "Paid",
  "expiresAt": "2026-04-29T00:47:00Z",
  "createdAt": "2026-04-29T00:17:00Z",
  "updatedAt": "2026-04-29T00:18:30Z"
}
```

### Response — 404 Not Found

```json
{
  "type": "NotFound",
  "title": "Charge not found.",
  "chargeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

---

## POST /webhooks/pix

Recebe um evento de pagamento PIX fake.

### Request

```http
POST /webhooks/pix
Content-Type: application/json
```

```json
{
  "eventId": "evt_123abc",
  "externalChargeId": "fakepsp_abc123def456",
  "referenceId": "RECIX-20260429-000001",
  "paidAmount": 150.75,
  "paidAt": "2026-04-29T00:18:00Z",
  "provider": "FakePixProvider"
}
```

**Validações:**
- `eventId`: obrigatório, não vazio, máximo 100 caracteres
- `paidAmount`: obrigatório, decimal > 0
- `paidAt`: obrigatório, datetime válido
- `provider`: obrigatório, não vazio
- `externalChargeId` ou `referenceId`: pelo menos um deve ser fornecido

### Response — 202 Accepted (novo evento)

```json
{
  "received": true,
  "eventId": "evt_123abc",
  "status": "Received"
}
```

### Response — 200 OK (duplicado)

```json
{
  "received": true,
  "eventId": "evt_123abc",
  "status": "IgnoredDuplicate"
}
```

### Response — 400 Bad Request

```json
{
  "type": "ValidationError",
  "title": "One or more validation errors occurred.",
  "errors": {
    "eventId": ["EventId is required."],
    "paidAmount": ["PaidAmount must be greater than zero."]
  }
}
```

---

## GET /payment-events

Lista eventos de pagamento recebidos.

### Request

```http
GET /payment-events?status=Processed&page=1&pageSize=20
```

**Query params:**
- `status` (opcional): `Received` | `Processing` | `Processed` | `Failed` | `IgnoredDuplicate`
- `page` (opcional, default: 1)
- `pageSize` (opcional, default: 20)

### Response — 200 OK

```json
{
  "items": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "eventId": "evt_123abc",
      "externalChargeId": "fakepsp_abc123def456",
      "referenceId": "RECIX-20260429-000001",
      "paidAmount": 150.75,
      "paidAt": "2026-04-29T00:18:00Z",
      "provider": "FakePixProvider",
      "status": "Processed",
      "createdAt": "2026-04-29T00:18:01Z",
      "processedAt": "2026-04-29T00:18:06Z"
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 20
}
```

---

## GET /reconciliations

Lista resultados de conciliação.

### Request

```http
GET /reconciliations?status=AmountMismatch&chargeId=3fa85f64-...&page=1&pageSize=20
```

**Query params:**
- `status` (opcional): `Matched` | `AmountMismatch` | `DuplicatePayment` | `PaymentWithoutCharge` | `ExpiredChargePaid` | `InvalidReference` | `ProcessingError`
- `chargeId` (opcional): uuid
- `paymentEventId` (opcional): uuid
- `page` (opcional, default: 1)
- `pageSize` (opcional, default: 20)

### Response — 200 OK

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "chargeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "paymentEventId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "status": "AmountMismatch",
      "reason": "Paid amount R$ 140.00 differs from expected R$ 150.75.",
      "expectedAmount": 150.75,
      "paidAmount": 140.00,
      "createdAt": "2026-04-29T00:18:06Z"
    }
  ],
  "totalCount": 1,
  "page": 1,
  "pageSize": 20
}
```

---

## GET /dashboard/summary

Retorna resumo financeiro geral.

### Request

```http
GET /dashboard/summary
```

### Response — 200 OK

```json
{
  "totalCharges": 100,
  "paidCharges": 80,
  "pendingCharges": 10,
  "divergentCharges": 7,
  "expiredCharges": 3,
  "totalReceivedAmount": 10000.50,
  "totalDivergentAmount": 450.00,
  "reconciliationIssues": {
    "amountMismatch": 3,
    "duplicatePayment": 2,
    "paymentWithoutCharge": 4,
    "expiredChargePaid": 1,
    "invalidReference": 0,
    "processingError": 0
  }
}
```

---

## GET /dashboard/overview

Retorna todos os dados necessários para renderizar o Dashboard da UI (KPIs, donut, problemas, fluxo financeiro, tabelas e alertas).

### Request
```http
GET /dashboard/overview?fromDate=2026-04-01&toDate=2026-04-30
```

**Query params (opcionais):**
- `fromDate` (opcional): ISO 8601 date (`yyyy-MM-dd`)
- `toDate` (opcional): ISO 8601 date (`yyyy-MM-dd`)

### Response — 200 OK
```json
{
  "updatedAt": "2026-04-29T00:20:00Z",
  "summary": {
    "totalCharges": 100,
    "paidCharges": 80,
    "pendingCharges": 10,
    "divergentCharges": 7,
    "expiredCharges": 3,
    "totalReceivedAmount": 10000.50,
    "totalDivergentAmount": 450.00,
    "reconciliationIssues": {
      "amountMismatch": 3,
      "duplicatePayment": 2,
      "paymentWithoutCharge": 4,
      "expiredChargePaid": 1,
      "invalidReference": 0,
      "processingError": 0
    }
  },
  "previousPeriodSummary": {
    "totalCharges": 88,
    "paidCharges": 72,
    "pendingCharges": 10,
    "divergentCharges": 5,
    "expiredCharges": 1,
    "totalReceivedAmount": 9000.50,
    "totalDivergentAmount": 350.00,
    "reconciliationIssues": {
      "amountMismatch": 2,
      "duplicatePayment": 1,
      "paymentWithoutCharge": 3,
      "expiredChargePaid": 1,
      "invalidReference": 0,
      "processingError": 0
    }
  },
  "fluxSeries": [
    {
      "label": "2026-04-29 10:00",
      "received": 2100.50,
      "expected": 2030.00,
      "divergent": 70.50
    }
  ],
  "recentReconciliations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "AmountMismatch",
      "reason": "Paid amount R$ 140,00 differs from expected R$ 150,75.",
      "expectedAmount": 150.75,
      "paidAmount": 140.00,
      "chargeReferenceId": "RECIX-20260429-000001",
      "paymentEventId": "evt_123abc",
      "createdAt": "2026-04-29T00:18:06Z"
    }
  ],
  "recentPaymentEvents": [
    {
      "eventId": "evt_123abc",
      "referenceId": "RECIX-20260429-000001",
      "paidAmount": 150.75,
      "provider": "FakePixProvider",
      "status": "Processed",
      "paidAt": "2026-04-29T00:18:00Z",
      "processedAt": "2026-04-29T00:18:06Z"
    }
  ],
  "alerts": [
    {
      "type": "amountMismatch",
      "count": 3,
      "lastDetectedAt": "2026-04-29T00:18:06Z",
      "description": "Amount Mismatch detectado no período.",
      "routeStatus": "AmountMismatch"
    },
    {
      "type": "duplicatePayment",
      "count": 2,
      "lastDetectedAt": "2026-04-29T00:18:01Z",
      "description": "Pagamentos duplicados detectados no período.",
      "routeStatus": "DuplicatePayment"
    },
    {
      "type": "paymentWithoutCharge",
      "count": 4,
      "lastDetectedAt": "2026-04-29T00:17:59Z",
      "description": "Pagamentos sem cobrança correspondente detectados.",
      "routeStatus": "PaymentWithoutCharge"
    }
  ]
}
```

---

## GET /ai/reconciliations/{id}/explanation

Retorna explicação em linguagem natural para uma conciliação (IA fake).

### Request

```http
GET /ai/reconciliations/550e8400-e29b-41d4-a716-446655440000/explanation
```

### Response — 200 OK

```json
{
  "reconciliationId": "550e8400-e29b-41d4-a716-446655440000",
  "explanation": "Este pagamento foi marcado como divergente porque o valor recebido foi R$ 140,00, mas a cobrança RECIX-20260429-000001 esperava R$ 150,75. A diferença de R$ 10,75 indica possível erro no valor enviado pelo pagador ou truncamento pelo provedor FakePixProvider.",
  "generatedAt": "2026-04-29T00:20:00Z",
  "model": "FakeAiInsightService/1.0"
}
```

### Response — 404 Not Found

```json
{
  "type": "NotFound",
  "title": "Reconciliation not found.",
  "reconciliationId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## GET /ai/summary/daily

Retorna resumo diário gerado por IA fake.

### Request

```http
GET /ai/summary/daily?date=2026-04-29
```

**Query params:**
- `date` (opcional, default: hoje): `yyyy-MM-dd`

### Response — 200 OK

```json
{
  "date": "2026-04-29",
  "summary": "Em 29/04/2026, foram criadas 10 cobranças totalizando R$ 1.507,50. Desse total, 8 foram pagas com sucesso, 1 apresentou divergência de valor e 1 ainda está pendente. Nenhum pagamento duplicado foi detectado.",
  "generatedAt": "2026-04-29T00:20:00Z",
  "model": "FakeAiInsightService/1.0"
}
```

---

## Códigos de Status HTTP

| Status | Uso |
|--------|-----|
| 200 OK | Sucesso em GET; webhook duplicado |
| 201 Created | Cobrança criada com sucesso |
| 202 Accepted | Webhook novo recebido e enfileirado |
| 400 Bad Request | Erro de validação |
| 404 Not Found | Recurso não encontrado |
| 500 Internal Server Error | Erro inesperado do servidor |

---

## Tratamento Global de Erros

Todas as respostas de erro seguem o formato:

```json
{
  "type": "string",
  "title": "string",
  "detail": "string (opcional)",
  "errors": { } 
}
```

Exceções não tratadas retornam 500 com:
```json
{
  "type": "InternalServerError",
  "title": "An unexpected error occurred."
}
```

Em ambiente Development, `detail` inclui a stack trace.
