# Domain Model Spec — RECIX Engine MVP

---

## Enums

### `ChargeStatus`

```
Pending    → Cobrança criada, aguardando pagamento
Paid       → Pagamento recebido e conciliado com sucesso
Expired    → Prazo expirou sem pagamento
Divergent  → Pagamento recebido com alguma inconsistência
Cancelled  → Cobrança cancelada manualmente (fora do escopo do MVP)
```

### `PaymentEventStatus`

```
Received          → Evento salvo, aguardando processamento
Processing        → BackgroundService está processando
Processed         → Processamento concluído com sucesso
Failed            → Processamento falhou com exceção
IgnoredDuplicate  → EventId já existia; ignorado por idempotência
```

### `ReconciliationStatus`

```
Matched               → Pagamento correto; cobrança paga com sucesso
AmountMismatch        → Valor pago diferente do esperado
DuplicatePayment      → Cobrança já estava Paid
PaymentWithoutCharge  → Nenhuma cobrança encontrada para o evento
ExpiredChargePaid     → Cobrança estava expirada ao receber o pagamento
InvalidReference      → ReferenceId/ExternalChargeId inconsistentes ou ausentes
ProcessingError       → Exceção durante o processamento
```

---

## Entidades

### `Charge`

**Propósito:** Representa uma cobrança PIX gerada pelo sistema.

**Campos:**
```
Id             : Guid          — PK, gerado no construtor
ReferenceId    : string        — identificador legível (RECIX-YYYYMMDD-NNNNNN)
ExternalId     : string        — ID fake do PSP
Amount         : decimal       — valor cobrado (> 0)
Status         : ChargeStatus  — estado atual
ExpiresAt      : DateTime      — UTC, quando a cobrança expira
CreatedAt      : DateTime      — UTC, imutável
UpdatedAt      : DateTime?     — UTC, atualizado em cada transição de status
```

**Invariantes:**
- `Amount` deve ser > 0. Cobrança com valor zero ou negativo nunca pode existir.
- `ExpiresAt` deve ser no futuro no momento da criação.
- `ReferenceId` e `ExternalId` são imutáveis após criação.
- `CreatedAt` é imutável após criação.

**Métodos de domínio:**
```
Create(referenceId, externalId, amount, expiresAt) : Charge
  → valida amount > 0
  → valida expiresAt > UtcNow
  → status inicial: Pending

IsExpired() : bool
  → retorna DateTime.UtcNow > ExpiresAt

MarkAsPaid() : void
  → pré-condição: Status == Pending
  → lança DomainException se Status != Pending
  → Status → Paid; UpdatedAt = UtcNow

MarkAsDivergent() : void
  → pré-condição: Status ∈ { Pending, Expired }
  → Status → Divergent; UpdatedAt = UtcNow

MarkAsExpired() : void
  → pré-condição: Status == Pending
  → Status → Expired; UpdatedAt = UtcNow

CanReceivePayment() : bool
  → retorna Status == Pending
```

**Transições de status válidas:**
```
Pending   → Paid        (via MarkAsPaid)
Pending   → Divergent   (via MarkAsDivergent)
Pending   → Expired     (via MarkAsExpired)
Expired   → Divergent   (via MarkAsDivergent — pagamento tardio)
```

**Transições inválidas (lançam DomainException):**
```
Paid      → qualquer
Divergent → qualquer
Cancelled → qualquer
Expired   → Paid
```

---

### `PaymentEvent`

**Propósito:** Representa o evento bruto recebido via webhook. É imutável após a criação; apenas o status e campos de processamento mudam.

**Campos:**
```
Id               : Guid               — PK
EventId          : string             — ID único do PSP (idempotência)
ExternalChargeId : string?            — ID da cobrança no PSP
ReferenceId      : string?            — ReferenceId legível da cobrança
PaidAmount       : decimal            — valor pago
PaidAt           : DateTime           — UTC, quando o PSP registrou o pagamento
Provider         : string             — nome do provedor (ex: "FakePixProvider")
RawPayload       : string             — JSON original do webhook (imutável)
Status           : PaymentEventStatus — estado atual do processamento
CreatedAt        : DateTime           — UTC, imutável
ProcessedAt      : DateTime?          — UTC, quando o processamento terminou
```

**Invariantes:**
- `EventId` é único no sistema.
- `RawPayload` nunca é alterado após a criação.
- `PaidAmount` deve ser > 0.
- `CreatedAt` é imutável.

**Métodos de domínio:**
```
Create(eventId, externalChargeId, referenceId, paidAmount, paidAt, provider, rawPayload) : PaymentEvent
  → status inicial: Received

MarkAsProcessing() : void
  → pré-condição: Status == Received
  → Status → Processing

MarkAsProcessed() : void
  → pré-condição: Status == Processing
  → Status → Processed; ProcessedAt = UtcNow

MarkAsFailed() : void
  → Status → Failed; ProcessedAt = UtcNow

MarkAsIgnoredDuplicate() : void
  → Status → IgnoredDuplicate
```

---

### `ReconciliationResult`

**Propósito:** Resultado imutável de uma tentativa de conciliação. Registro de auditoria permanente.

**Campos:**
```
Id              : Guid                  — PK
ChargeId        : Guid?                 — FK opcional para Charge
PaymentEventId  : Guid                  — FK para PaymentEvent
Status          : ReconciliationStatus  — resultado da conciliação
Reason          : string               — descrição legível do resultado
ExpectedAmount  : decimal?             — valor esperado (null se sem cobrança)
PaidAmount      : decimal              — valor pago
CreatedAt       : DateTime             — UTC, imutável
```

**Invariantes:**
- `ReconciliationResult` é completamente imutável após criação.
- `Reason` nunca é vazio.
- `PaidAmount` > 0.
- `ChargeId` pode ser null (cenário `PaymentWithoutCharge`).

**Método de fábrica:**
```
Create(chargeId?, paymentEventId, status, reason, expectedAmount?, paidAmount) : ReconciliationResult
```

---

## Value Objects

### `Money` (implícito via decimal)

Para o MVP, `Amount`, `PaidAmount` e `ExpectedAmount` são `decimal` simples. Não há necessidade de Value Object formal. Registrado em [decisions.md](decisions.md).

### `ReferenceId` (implícito via string)

Formato: `RECIX-{YYYYMMDD}-{NNNNNN}`

Gerado pelo serviço de aplicação, não pela entidade. Validado como não-nulo e não-vazio.

---

## Regras de Conciliação (ReconciliationEngine)

A lógica de conciliação vive em `Recix.Application` como um serviço de domínio `ReconciliationEngine`.

### Matriz de decisão

| Condição | Status da Conciliação | Ação na Charge |
|---|---|---|
| Charge encontrada + Pending + valor igual + não expirada | `Matched` | `MarkAsPaid()` |
| Charge encontrada + Pending + valor **diferente** + não expirada | `AmountMismatch` | `MarkAsDivergent()` |
| Charge encontrada + Pending + valor diferente + expirada | `ExpiredChargePaid` | `MarkAsDivergent()` |
| Charge encontrada + Pending + valor igual + **expirada** | `ExpiredChargePaid` | `MarkAsDivergent()` |
| Charge encontrada + status `Paid` | `DuplicatePayment` | sem ação |
| Charge encontrada + status `Divergent` | `DuplicatePayment` | sem ação |
| Nenhuma Charge encontrada | `PaymentWithoutCharge` | sem ação (ChargeId = null) |
| ExternalChargeId e ReferenceId ambos ausentes no evento | `InvalidReference` | sem ação |
| Exceção durante processamento | `ProcessingError` | sem ação |

### Regra de prioridade na busca da Charge:
1. Busca por `ExternalChargeId` primeiro.
2. Se não encontrar, busca por `ReferenceId`.
3. Se nenhum encontrar → `PaymentWithoutCharge`.
4. Se ambos forem nulos/vazios → `InvalidReference`.

---

## Exceções de Domínio

### `DomainException`
Lançada quando uma invariante é violada ou uma transição inválida é tentada.

Exemplos:
- `"Charge amount must be greater than zero."`
- `"Cannot mark a Paid charge as Paid again."`
- `"Cannot mark a Paid charge as Divergent."`
- `"Charge expiration must be in the future."`
