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

- [ ] **T2.1** — Criar `DomainException` em `Recix.Domain/Exceptions/`
- [ ] **T2.2** — Criar enum `ChargeStatus` em `Recix.Domain/Enums/`
- [ ] **T2.3** — Criar enum `PaymentEventStatus` em `Recix.Domain/Enums/`
- [ ] **T2.4** — Criar enum `ReconciliationStatus` em `Recix.Domain/Enums/`
- [ ] **T2.5** — Criar entidade `Charge` com todos os campos, métodos e invariantes (domain-model.md §Charge)
- [ ] **T2.6** — Criar entidade `PaymentEvent` com todos os campos e métodos (domain-model.md §PaymentEvent)
- [ ] **T2.7** — Criar entidade `ReconciliationResult` com método de fábrica (domain-model.md §ReconciliationResult)
- [ ] **T2.8** — Garantir `dotnet build` sem erros

**Critério de aceite:** Entidades compilam; invariantes representadas no código.

---

## Fase 3 — Testes de Domínio

**Objetivo:** Validar invariantes e transições com testes unitários. Spec: domain-model.md, product-spec.md §Critérios.

### Tarefas

- [ ] **T3.1** — Implementar `ChargeTests`:
  - Não pode ser criada com amount <= 0
  - Pending → Paid via MarkAsPaid()
  - Paid → Paid lança DomainException
  - IsExpired() retorna true quando expirada
  - MarkAsDivergent() em Pending funciona
  - MarkAsDivergent() em Expired funciona
  - MarkAsDivergent() em Paid lança DomainException
- [ ] **T3.2** — Implementar `PaymentEventTests`:
  - Criação com campos válidos
  - Transição Received → Processing → Processed
  - MarkAsFailed() em qualquer estado
- [ ] **T3.3** — Implementar `ReconciliationResultTests`:
  - Criação com ChargeId null (PaymentWithoutCharge)
  - Criação com todos os campos
- [ ] **T3.4** — Garantir `dotnet test` sem falhas

**Critério de aceite:** Todos os testes de domínio passam.

---

## Fase 4 — Infrastructure: DbContext e Migrations

**Objetivo:** Criar DbContext, mapeamentos EF e migration inicial. Spec: technical-spec.md §Banco de Dados.

### Tarefas

- [ ] **T4.1** — Criar `RecixDbContext` com DbSets para as 3 entidades
- [ ] **T4.2** — Criar configurações EF (`IEntityTypeConfiguration`) para `Charge`
- [ ] **T4.3** — Criar configurações EF para `PaymentEvent` (incluindo índice UNIQUE em EventId)
- [ ] **T4.4** — Criar configurações EF para `ReconciliationResult`
- [ ] **T4.5** — Criar migration inicial `InitialCreate`
- [ ] **T4.6** — Validar SQL gerado conforme tabelas da technical-spec.md

**Critério de aceite:** Migration gerada; `dotnet ef database update` roda sem erros contra PostgreSQL local.

---

## Fase 5 — Infrastructure: Repositories

**Objetivo:** Implementar contratos e repositórios concretos. Spec: technical-spec.md §Arquitetura.

### Tarefas

- [ ] **T5.1** — Criar interface `IChargeRepository` em `Recix.Application/Interfaces/`
  - `GetByIdAsync`, `GetByReferenceIdAsync`, `GetByExternalIdAsync`, `AddAsync`, `UpdateAsync`, `ListAsync` (com filtros)
- [ ] **T5.2** — Criar interface `IPaymentEventRepository`
  - `GetByEventIdAsync`, `GetByStatusAsync`, `AddAsync`, `UpdateAsync`, `ListAsync` (com filtros)
- [ ] **T5.3** — Criar interface `IReconciliationRepository`
  - `AddAsync`, `ListAsync` (com filtros)
- [ ] **T5.4** — Implementar `ChargeRepository` em `Recix.Infrastructure/Repositories/`
- [ ] **T5.5** — Implementar `PaymentEventRepository`
- [ ] **T5.6** — Implementar `ReconciliationRepository`
- [ ] **T5.7** — Garantir `dotnet build` sem erros

**Critério de aceite:** Repositórios compilam e implementam todas as interfaces.

---

## Fase 6 — Application: Use Cases

**Objetivo:** Implementar os 3 use cases principais. Spec: technical-spec.md §Fluxo Assíncrono, api-contract.md.

### Tarefas

- [ ] **T6.1** — Criar DTOs de request/response em `Recix.Application/DTOs/`
  - `CreateChargeRequest`, `CreateChargeResponse`
  - `ReceivePixWebhookRequest`, `ReceivePixWebhookResponse`
  - `ChargeDto`, `PaymentEventDto`, `ReconciliationDto`
  - `DashboardSummaryDto`
  - `PagedResult<T>`
- [ ] **T6.2** — Implementar `CreateChargeUseCase`
  - Valida request
  - Gera ReferenceId (formato RECIX-YYYYMMDD-NNNNNN)
  - Gera ExternalId fake
  - Cria Charge via factory
  - Persiste
  - Retorna CreateChargeResponse
- [ ] **T6.3** — Implementar `ReceivePixWebhookUseCase`
  - Verifica duplicidade por EventId
  - Se duplicado: retorna IgnoredDuplicate
  - Salva evento bruto com RawPayload
  - Retorna Received
- [ ] **T6.4** — Implementar `ReconciliationEngine` em `Recix.Application/Services/`
  - Implementa matriz de decisão do domain-model.md
- [ ] **T6.5** — Implementar `ProcessPaymentEventUseCase`
  - Busca evento
  - Marca Processing
  - Busca Charge
  - Chama ReconciliationEngine
  - Cria ReconciliationResult
  - Atualiza Charge e PaymentEvent
- [ ] **T6.6** — Criar interface `IAiInsightService` em `Recix.Application/Interfaces/`
- [ ] **T6.7** — Garantir `dotnet build` sem erros

**Critério de aceite:** Use cases compilam; lógica de conciliação cobre todos os 7 cenários.

---

## Fase 7 — Testes de Aplicação

**Objetivo:** Testar use cases com repositórios fake. Spec: product-spec.md §Testes obrigatórios.

### Tarefas

- [ ] **T7.1** — Criar fakes/stubs de repositórios em memória para testes
- [ ] **T7.2** — Testar `CreateChargeUseCase`
  - Charge criada com dados corretos
  - ReferenceId no formato correto
  - Erro com amount <= 0
- [ ] **T7.3** — Testar `ReceivePixWebhookUseCase`
  - Evento salvo com status Received
  - Duplicado retorna IgnoredDuplicate sem novo registro
- [ ] **T7.4** — Testar `ProcessPaymentEventUseCase` para todos os 6 cenários de conciliação:
  - Matched
  - AmountMismatch
  - DuplicatePayment
  - PaymentWithoutCharge
  - ExpiredChargePaid
  - InvalidReference
- [ ] **T7.5** — Garantir `dotnet test` sem falhas

**Critério de aceite:** Todos os cenários de conciliação têm teste passando.

---

## Fase 8 — Infrastructure: BackgroundService e AI Fake

**Objetivo:** Processamento assíncrono e serviço de IA fake. Spec: technical-spec.md §Fluxo Assíncrono.

### Tarefas

- [ ] **T8.1** — Implementar `PaymentEventProcessorService` (BackgroundService)
  - Loop a cada 5 segundos
  - Busca até 10 eventos com status Received
  - Chama `ProcessPaymentEventUseCase` para cada
  - Captura exceções por evento; nunca deixa o loop morrer
  - Loga início, sucesso e falha de cada evento
- [ ] **T8.2** — Implementar `FakeAiInsightService` implementando `IAiInsightService`
  - `ExplainReconciliationAsync`: gera texto baseado no `ReconciliationStatus` e valores
  - `GenerateDailySummaryAsync`: gera texto com contagens do dia
- [ ] **T8.3** — Garantir `dotnet build` sem erros

**Critério de aceite:** BackgroundService registrado no DI; FakeAiInsightService gera textos coerentes para cada status.

---

## Fase 9 — API: Endpoints

**Objetivo:** Criar todos os endpoints Minimal API. Spec: api-contract.md.

### Tarefas

- [ ] **T9.1** — Configurar `Program.cs`: DI, Swagger, middleware de erro global, EF migrations no startup
- [ ] **T9.2** — Criar endpoint `POST /charges` (api-contract.md §POST /charges)
- [ ] **T9.3** — Criar endpoints `GET /charges` e `GET /charges/{id}`
- [ ] **T9.4** — Criar endpoint `POST /webhooks/pix`
- [ ] **T9.5** — Criar endpoint `GET /payment-events`
- [ ] **T9.6** — Criar endpoint `GET /reconciliations`
- [ ] **T9.7** — Criar endpoint `GET /dashboard/summary`
  - Implementar query de sumário em `DashboardQueryService` ou diretamente no repositório
- [ ] **T9.8** — Criar endpoints `GET /ai/reconciliations/{id}/explanation` e `GET /ai/summary/daily`
- [ ] **T9.9** — Configurar Swagger com descrições de todos os endpoints
- [ ] **T9.10** — Testar manualmente via Swagger UI (subir localmente)

**Critério de aceite:** Swagger acessível; todos os endpoints respondem com status codes corretos conforme api-contract.md.

---

## Fase 10 — Docker Compose e Arquivo .http

**Objetivo:** Infraestrutura local e exemplos de requests. Spec: technical-spec.md §Docker Compose.

### Tarefas

- [ ] **T10.1** — Criar `docker-compose.yml` com serviços `recix-api` e `recix-db`
- [ ] **T10.2** — Criar `Dockerfile` para `Recix.Api`
- [ ] **T10.3** — Criar arquivo `Recix.Api/Requests/recix.http` com:
  - Request 1: Criar cobrança normal
  - Request 2: Enviar pagamento correto
  - Request 3: Enviar pagamento duplicado
  - Request 4: Enviar pagamento com valor menor
  - Request 5: Enviar pagamento sem cobrança
  - Request 6: Enviar pagamento para cobrança expirada
  - Request 7: Consultar cobranças
  - Request 8: Consultar dashboard/summary
  - Request 9: Pedir explicação de IA para conciliação divergente
- [ ] **T10.4** — Testar `docker compose up` do zero (sem volumes)
- [ ] **T10.5** — Validar fluxo ponta a ponta via arquivo .http

**Critério de aceite:** `docker compose up` sobe tudo; fluxo ponta a ponta funciona.

---

## Fase 11 — Validação Final

**Objetivo:** Verificar todos os critérios de aceite do product-spec.md.

### Checklist de aceite

- [ ] `docker compose up` sobe sem erros
- [ ] Swagger acessível em `http://localhost:5000/swagger`
- [ ] Criar cobrança via `POST /charges`
- [ ] Enviar webhook via `POST /webhooks/pix`
- [ ] Webhook processado de forma assíncrona (verificar via `GET /payment-events`)
- [ ] Conciliação Matched funciona
- [ ] Conciliação AmountMismatch funciona
- [ ] Conciliação DuplicatePayment funciona
- [ ] Conciliação PaymentWithoutCharge funciona
- [ ] Conciliação ExpiredChargePaid funciona
- [ ] `GET /dashboard/summary` retorna dados corretos
- [ ] `GET /ai/reconciliations/{id}/explanation` retorna explicação coerente
- [ ] `dotnet test` passa sem falhas

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
