# Implementation Plan — RECIX Engine MVP

## Convenções

- Cada tarefa é atômica e pequena.
- Ao implementar, referência a spec deve ser citada no commit ou no comentário do PR.
- Checklist atualizado a cada tarefa concluída.
- Build deve passar após cada fase.

---

## Fase 1 — Estrutura da Solution

**Objetivo:** Criar projetos, referências e configuração base. Zero código de negócio.

### Tarefas

- [x] **T1.1** — Criar solution `Recix.sln` (criado como `Recix.slnx` — novo formato .NET 9)
- [x] **T1.2** — Criar projeto `Recix.Domain` (classlib, .NET 9)
- [x] **T1.3** — Criar projeto `Recix.Application` (classlib, .NET 9)
- [x] **T1.4** — Criar projeto `Recix.Infrastructure` (classlib, .NET 9)
- [x] **T1.5** — Criar projeto `Recix.Api` (webapi, .NET 9, Minimal API)
- [x] **T1.6** — Criar projeto `Recix.Tests` (xunit, .NET 9)
- [x] **T1.7** — Configurar referências entre projetos conforme technical-spec.md
- [x] **T1.8** — Instalar NuGet packages conforme technical-spec.md (EF Core 9.x, Npgsql 9.x, Swashbuckle, FluentAssertions)
- [x] **T1.9** — Garantir `dotnet build` sem erros ✓ (0 erros, 0 warnings)

**Critério de aceite:** `dotnet build Recix.sln` retorna 0 erros, 0 warnings críticos.

---

## Fase 2 — Domain Layer

**Objetivo:** Implementar entidades, enums, invariantes e exceção de domínio. Spec: domain-model.md.

### Tarefas

- [x] **T2.1** — Criar `DomainException` em `Recix.Domain/Exceptions/`
- [x] **T2.2** — Criar enum `ChargeStatus` em `Recix.Domain/Enums/`
- [x] **T2.3** — Criar enum `PaymentEventStatus` em `Recix.Domain/Enums/`
- [x] **T2.4** — Criar enum `ReconciliationStatus` em `Recix.Domain/Enums/`
- [x] **T2.5** — Criar entidade `Charge` com todos os campos, métodos e invariantes (domain-model.md §Charge)
- [x] **T2.6** — Criar entidade `PaymentEvent` com todos os campos e métodos (domain-model.md §PaymentEvent)
- [x] **T2.7** — Criar entidade `ReconciliationResult` com método de fábrica (domain-model.md §ReconciliationResult)
- [x] **T2.8** — Garantir `dotnet build` sem erros ✓ (0 erros, 0 warnings)

**Critério de aceite:** Entidades compilam; invariantes representadas no código.

---

## Fase 3 — Testes de Domínio

**Objetivo:** Validar invariantes e transições com testes unitários. Spec: domain-model.md, product-spec.md §Critérios.

### Tarefas

- [x] **T3.1** — Implementar `ChargeTests` (14 testes)
- [x] **T3.2** — Implementar `PaymentEventTests` (10 testes)
- [x] **T3.3** — Implementar `ReconciliationResultTests` (6 testes + theory)
- [x] **T3.4** — Garantir `dotnet test` sem falhas ✓ (33/33 aprovados)

**Critério de aceite:** Todos os testes de domínio passam.

---

## Fase 4 — Infrastructure: DbContext e Migrations

**Objetivo:** Criar DbContext, mapeamentos EF e migration inicial. Spec: technical-spec.md §Banco de Dados.

### Tarefas

- [x] **T4.1** — Criar `RecixDbContext` com DbSets para as 3 entidades
- [x] **T4.2** — Criar configurações EF (`IEntityTypeConfiguration`) para `Charge`
- [x] **T4.3** — Criar configurações EF para `PaymentEvent` (incluindo índice UNIQUE em EventId)
- [x] **T4.4** — Criar configurações EF para `ReconciliationResult`
- [x] **T4.5** — Criar migration inicial `InitialCreate` (20260429033324_InitialCreate)
- [x] **T4.6** — Validar SQL gerado conforme tabelas da technical-spec.md ✓

**Critério de aceite:** Migration gerada; `dotnet ef database update` roda sem erros contra PostgreSQL local.

---

## Fase 5 — Infrastructure: Repositories

**Objetivo:** Implementar contratos e repositórios concretos. Spec: technical-spec.md §Arquitetura.

### Tarefas

- [x] **T5.1** — Criar interface `IChargeRepository` em `Recix.Application/Interfaces/`
- [x] **T5.2** — Criar interface `IPaymentEventRepository`
- [x] **T5.3** — Criar interface `IReconciliationRepository`
- [x] **T5.4** — Implementar `ChargeRepository` em `Recix.Infrastructure/Repositories/`
- [x] **T5.5** — Implementar `PaymentEventRepository`
- [x] **T5.6** — Implementar `ReconciliationRepository`
- [x] **T5.7** — Garantir `dotnet build` sem erros ✓ (0 erros)

**Critério de aceite:** Repositórios compilam e implementam todas as interfaces.

---

## Fase 6 — Application: Use Cases

**Objetivo:** Implementar os 3 use cases principais. Spec: technical-spec.md §Fluxo Assíncrono, api-contract.md.

### Tarefas

- [x] **T6.1** — Criar DTOs (CreateChargeRequest/Response, ReceivePixWebhookRequest/Response, ChargeDto, PaymentEventDto, ReconciliationDto, DashboardSummaryDto, PagedResult<T>)
- [x] **T6.2** — Implementar `CreateChargeUseCase` (gera ReferenceId RECIX-YYYYMMDD-NNNNNN, ExternalId fake)
- [x] **T6.3** — Implementar `ReceivePixWebhookUseCase` (idempotência por EventId, persiste RawPayload)
- [x] **T6.4** — Implementar `ReconciliationEngine` com `ReconciliationOutcome` (todos os 6 cenários)
- [x] **T6.5** — Implementar `ProcessPaymentEventUseCase` (Processing → Processed/Failed, atualiza Charge)
- [x] **T6.6** — Criar interface `IAiInsightService` com `AiExplanationResult` e `AiSummaryResult`
- [x] **T6.7** — Garantir `dotnet build` sem erros ✓ (0 erros)

**Critério de aceite:** Use cases compilam; lógica de conciliação cobre todos os 7 cenários.

---

## Fase 7 — Testes de Aplicação

**Objetivo:** Testar use cases com repositórios fake. Spec: product-spec.md §Testes obrigatórios.

### Tarefas

- [x] **T7.1** — Criar fakes em memória (FakeChargeRepository, FakePaymentEventRepository, FakeReconciliationRepository, NullLogger)
- [x] **T7.2** — Testar `CreateChargeUseCase` (6 testes: formato ReferenceId, sequencial, validações)
- [x] **T7.3** — Testar `ReceivePixWebhookUseCase` (5 testes: Received, duplicata, RawPayload)
- [x] **T7.4** — Testar `ProcessPaymentEventUseCase` — todos os 6 cenários + resiliência + transição de status (8 testes)
- [x] **T7.5** — Garantir `dotnet test` sem falhas ✓ (52/52 aprovados)

**Critério de aceite:** Todos os cenários de conciliação têm teste passando.

---

## Fase 8 — Infrastructure: BackgroundService e AI Fake

**Objetivo:** Processamento assíncrono e serviço de IA fake. Spec: technical-spec.md §Fluxo Assíncrono.

### Tarefas

- [x] **T8.1** — Implementar `PaymentEventProcessorService` (BackgroundService, scope por iteração, batch=10, polling=5s)
- [x] **T8.2** — Implementar `FakeAiInsightService` (explicações por ReconciliationStatus + resumo diário)
- [x] **T8.3** — Garantir `dotnet build` sem erros ✓ (0 erros, 52/52 testes)

**Critério de aceite:** BackgroundService registrado no DI; FakeAiInsightService gera textos coerentes para cada status.

---

## Fase 9 — API: Endpoints

**Objetivo:** Criar todos os endpoints Minimal API. Spec: api-contract.md.

### Tarefas

- [x] **T9.1** — Configurar `Program.cs` (DI via AddInfrastructure, Swagger, ErrorHandlingMiddleware, MigrateAsync)
- [x] **T9.2** — `POST /charges` + `GET /charges` + `GET /charges/{id}`
- [x] **T9.3** — `POST /webhooks/pix` (202 novo, 200 duplicado) + `GET /payment-events`
- [x] **T9.4** — `GET /reconciliations` com filtros + `GET /dashboard/summary` via DashboardQueryService
- [x] **T9.5** — `GET /ai/reconciliations/{id}/explanation` + `GET /ai/summary/daily`
- [x] **T9.6** — Build 0 erros ✓ | 52/52 testes ✓
- [ ] **T9.10** — Testar manualmente via Swagger UI (após Fase 10 — Docker)

**Critério de aceite:** Swagger acessível; todos os endpoints respondem com status codes corretos conforme api-contract.md.

---

## Fase 10 — Docker Compose e Arquivo .http

**Objetivo:** Infraestrutura local e exemplos de requests. Spec: technical-spec.md §Docker Compose.

### Tarefas

- [x] **T10.1** — Criar `docker-compose.yml` (recix-api + recix-db com healthcheck)
- [x] **T10.2** — Criar `Dockerfile` multi-stage para `Recix.Api`
- [x] **T10.3** — Configurar appsettings + .dockerignore
- [x] **T10.4** — Criar `Recix.Api/Requests/recix.http` com 12 requests (todos os 6 cenários + consultas + IA)
- [x] **T10.5** — Validar `docker compose up` ✓ — fluxo ponta a ponta confirmado:
  - Matched ✓ | AmountMismatch ✓ | DuplicatePayment ✓ | PaymentWithoutCharge ✓ | InvalidReference ✓
  - Dashboard/Summary ✓ | AI Explanation ✓ | AI Daily Summary ✓

**Critério de aceite:** `docker compose up` sobe tudo; fluxo ponta a ponta funciona.

---

## Fase 11 — Validação Final

**Objetivo:** Verificar todos os critérios de aceite do product-spec.md.

### Checklist de aceite

- [x] `docker compose up` sobe sem erros ✓
- [x] Swagger acessível em `http://localhost:5000/swagger` ✓ (HTTP 200)
- [x] Criar cobrança via `POST /charges` ✓ (status Pending, ReferenceId RECIX-YYYYMMDD-NNNNNN)
- [x] Enviar webhook via `POST /webhooks/pix` ✓ (202 Received)
- [x] Webhook processado de forma assíncrona ✓ (BackgroundService processa em ~5s, status Processed)
- [x] Conciliação Matched funciona ✓ (Charge → Paid)
- [x] Conciliação AmountMismatch funciona ✓ (Charge → Divergent, diff na reason)
- [x] Conciliação DuplicatePayment funciona ✓ (IgnoredDuplicate retornado, 0 novos registros)
- [x] Conciliação PaymentWithoutCharge funciona ✓ (ChargeId null)
- [x] Conciliação ExpiredChargePaid funciona ✓ (Charge → Divergent, status ExpiredChargePaid)
- [x] `GET /dashboard/summary` retorna dados corretos ✓
- [x] `GET /ai/reconciliations/{id}/explanation` retorna explicação coerente ✓ (PT-BR)
- [x] `dotnet test` passa sem falhas ✓ (52/52 aprovados)

---

## Dependências entre Fases

```
Fase 1 (estrutura)
  → Fase 2 (domain)
      → Fase 3 (testes de domínio)
      → Fase 4 (infrastructure/DB)
          → Fase 5 (repositories)
              → Fase 6 (use cases)
                  → Fase 7 (testes de aplicação)
                  → Fase 8 (background service + AI)
                      → Fase 9 (endpoints)
                          → Fase 10 (docker + .http)
                              → Fase 11 (validação final)
```
