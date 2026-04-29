# Technical Spec — RECIX Engine MVP

## Arquitetura

Clean Architecture com 4 camadas. Dependências apontam sempre de fora para dentro (Infrastructure → Application → Domain). A API é a camada de entrada.

```
┌─────────────────────────────────────────────────────────┐
│                      Recix.Api                          │
│  Minimal APIs · Middlewares · DI Config · Swagger       │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Recix.Application                      │
│  Use Cases · DTOs · Interfaces · Commands · Queries     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Recix.Domain                         │
│  Entities · Value Objects · Enums · Domain Rules        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                 Recix.Infrastructure                    │
│  EF Core · Repositories · BackgroundService · AI Fake  │
└─────────────────────────────────────────────────────────┘
```

---

## Projetos da Solution

### `Recix.Api`
- Minimal API endpoints
- Middleware de tratamento global de erros
- Configuração de DI (injeção de dependências)
- Swagger/OpenAPI
- Recebimento e validação de webhooks

### `Recix.Application`
- Use cases: `CreateChargeUseCase`, `ReceivePixWebhookUseCase`, `ProcessPaymentEventUseCase`
- Interfaces: `IChargeRepository`, `IPaymentEventRepository`, `IReconciliationRepository`, `IAiInsightService`
- DTOs de request/response
- Lógica de conciliação (`ReconciliationEngine`)
- Nenhuma dependência de infraestrutura

### `Recix.Domain`
- Entidades: `Charge`, `PaymentEvent`, `ReconciliationResult`
- Enums: `ChargeStatus`, `PaymentEventStatus`, `ReconciliationStatus`
- Invariantes e métodos de domínio
- Sem dependências externas (zero NuGet packages além de testes)

### `Recix.Infrastructure`
- `RecixDbContext` com EF Core
- Repositories concretos
- Migrations do banco
- `PaymentEventProcessorService` (BackgroundService)
- `FakeAiInsightService`
- Configuração de conexão com PostgreSQL

### `Recix.Tests`
- Testes unitários de domínio
- Testes de aplicação (use cases)
- Usa xUnit + FluentAssertions

---

## Referências entre projetos

```
Recix.Api           → Recix.Application, Recix.Infrastructure
Recix.Application   → Recix.Domain
Recix.Infrastructure → Recix.Application, Recix.Domain
Recix.Tests         → Recix.Domain, Recix.Application, Recix.Infrastructure
```

---

## Dependências (NuGet)

### Recix.Api
- `Microsoft.AspNetCore.OpenApi`
- `Swashbuckle.AspNetCore`

### Recix.Application
- (nenhuma dependência externa)

### Recix.Domain
- (nenhuma dependência externa)

### Recix.Infrastructure
- `Microsoft.EntityFrameworkCore`
- `Npgsql.EntityFrameworkCore.PostgreSQL`
- `Microsoft.Extensions.Hosting`

### Recix.Tests
- `xunit`
- `xunit.runner.visualstudio`
- `FluentAssertions`
- `Microsoft.EntityFrameworkCore.InMemory` (para testes de repositório)

---

## Banco de Dados

**PostgreSQL 16**

### Tabelas

#### `charges`
| Coluna        | Tipo            | Constraints                |
|---------------|-----------------|----------------------------|
| id            | uuid            | PK                         |
| reference_id  | varchar(50)     | NOT NULL, UNIQUE           |
| external_id   | varchar(100)    | NOT NULL                   |
| amount        | numeric(18,2)   | NOT NULL, CHECK > 0        |
| status        | varchar(20)     | NOT NULL                   |
| expires_at    | timestamptz     | NOT NULL                   |
| created_at    | timestamptz     | NOT NULL                   |
| updated_at    | timestamptz     | NULL                       |

#### `payment_events`
| Coluna              | Tipo            | Constraints                |
|---------------------|-----------------|----------------------------|
| id                  | uuid            | PK                         |
| event_id            | varchar(100)    | NOT NULL, UNIQUE           |
| external_charge_id  | varchar(100)    | NULL                       |
| reference_id        | varchar(50)     | NULL                       |
| paid_amount         | numeric(18,2)   | NOT NULL                   |
| paid_at             | timestamptz     | NOT NULL                   |
| provider            | varchar(100)    | NOT NULL                   |
| raw_payload         | text            | NOT NULL                   |
| status              | varchar(30)     | NOT NULL                   |
| created_at          | timestamptz     | NOT NULL                   |
| processed_at        | timestamptz     | NULL                       |

#### `reconciliation_results`
| Coluna           | Tipo            | Constraints                |
|------------------|-----------------|----------------------------|
| id               | uuid            | PK                         |
| charge_id        | uuid            | NULL, FK → charges.id      |
| payment_event_id | uuid            | NOT NULL, FK → payment_events.id |
| status           | varchar(30)     | NOT NULL                   |
| reason           | text            | NOT NULL                   |
| expected_amount  | numeric(18,2)   | NULL                       |
| paid_amount      | numeric(18,2)   | NOT NULL                   |
| created_at       | timestamptz     | NOT NULL                   |

### Índices

```sql
CREATE UNIQUE INDEX ix_payment_events_event_id ON payment_events(event_id);
CREATE INDEX ix_payment_events_status ON payment_events(status);
CREATE INDEX ix_charges_status ON charges(status);
CREATE INDEX ix_charges_reference_id ON charges(reference_id);
CREATE INDEX ix_charges_external_id ON charges(external_id);
CREATE INDEX ix_reconciliation_results_charge_id ON reconciliation_results(charge_id);
CREATE INDEX ix_reconciliation_results_payment_event_id ON reconciliation_results(payment_event_id);
```

---

## Fluxo Assíncrono

```
POST /webhooks/pix
       │
       ▼
ReceivePixWebhookUseCase
  1. Valida payload
  2. Verifica duplicidade por EventId (retorna IgnoredDuplicate se já existe)
  3. Salva PaymentEvent com status=Received
  4. Retorna { received: true, eventId, status: "Received" } imediatamente
       │
       ▼ (assíncrono)
PaymentEventProcessorService (BackgroundService)
  Loop a cada 5 segundos:
  1. Busca PaymentEvents com status=Received (batch de 10)
  2. Marca cada um como Processing
  3. Chama ProcessPaymentEventUseCase para cada evento
  4. ProcessPaymentEventUseCase:
     a. Busca Charge por ExternalChargeId ou ReferenceId
     b. Executa ReconciliationEngine
     c. Cria ReconciliationResult
     d. Atualiza status da Charge se necessário
     e. Marca PaymentEvent como Processed
  5. Em caso de exceção: marca PaymentEvent como Failed, loga erro
```

---

## Regras de Idempotência

1. **EventId único**: índice UNIQUE em `payment_events.event_id`. Se webhook chegar com EventId já existente, retorna `{ received: true, status: "IgnoredDuplicate" }` sem processar.
2. **Verificação no use case**: antes de inserir, consulta banco por EventId. Se já existir, retorna sem throw.
3. **Status de idempotência**: `PaymentEventStatus.IgnoredDuplicate` registra o caso para auditoria.
4. **Cobrança paga**: `Charge` com status `Paid` não pode virar `Paid` novamente — gera `DuplicatePayment` na conciliação.
5. **ReconciliationResult imutável**: resultados criados nunca são alterados; novos resultados são inseridos.

---

## Geração de ReferenceId

Formato: `RECIX-{YYYYMMDD}-{SEQUENCIAL:6}`

Exemplo: `RECIX-20260429-000001`

Implementação: contador atômico baseado em contagem de cobranças do dia + 1. Simples para MVP, sem lock distribuído.

---

## Estratégia de Testes

### Testes de Domínio (unitários puros)
- Sem dependências externas.
- Testam invariantes, métodos e transições de status das entidades.
- Executam em memória.

### Testes de Aplicação
- Testam use cases com repositórios fake (in-memory ou mocks).
- Cobrem todos os cenários de conciliação.
- Usam `InMemoryDatabase` do EF Core para testes mais próximos do real.

### O que NÃO testar no MVP
- Endpoints HTTP (sem integration tests de HTTP neste MVP).
- BackgroundService (testado indiretamente via use case).

---

## Dashboard Overview Endpoint

O endpoint `GET /dashboard/overview` é a fonte única para renderizar a dashboard da UI (KPIs, donut, problemas, fluxo financeiro, tabelas e alertas).

### Responsabilidades
- Retornar `summary` (métricas atuais) e `previousPeriodSummary` (mesmo intervalo anterior) para cálculo do delta do card “Total de Cobranças”.
- Retornar `fluxSeries` (séries temporais) com pontos `received`, `expected` e `divergent`.
- Retornar itens recentes para preencher:
  - `Últimas Conciliações`
  - `Últimos Eventos de Pagamento`
- Retornar `alerts` com contagem e `lastDetectedAt` para exibir “há X minutos”.

### Semântica de timestamps (MVP)
- `updatedAt` da `Charge` é a principal fonte para indicar quando um status monetário muda (ex.: `Paid` e `Divergent`).
- `createdAt` da `ReconciliationResult` é a principal fonte para “últimas conciliações” e para a data mais recente dos alertas (`lastDetectedAt`).
- `paidAt`/`processedAt` do `PaymentEvent` é usada para o texto “Recebido em”.

### Consistência com `DashboardQueryService.GetSummaryAsync`
- A regra de cálculo dos totais monetários e contagens em `summary` segue exatamente a mesma lógica já usada em `GetSummaryAsync`.
- Para a série do “Fluxo Financeiro”:
  - `expected = received - divergent`
  - `divergent` equivale à soma dos valores das cobranças em `Divergent` dentro do período.

---

## Docker Compose

Serviços:
- `recix-api`: build da API, porta 5000
- `recix-db`: PostgreSQL 16, porta 5432

Variáveis de ambiente da API:
```
ASPNETCORE_ENVIRONMENT=Development
ConnectionStrings__DefaultConnection=Host=recix-db;Port=5432;Database=recix;Username=recix;Password=recix123
```

Healthcheck na API aguarda PostgreSQL estar pronto antes de iniciar.

---

## Riscos Técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Race condition no BackgroundService processando mesmo evento duas vezes | Baixa | Alto | Status `Processing` é setado antes do processamento; índice UNIQUE no EventId |
| Evento preso em `Processing` após crash | Média | Médio | Timeout de recovery: eventos em `Processing` há mais de 5 minutos voltam para `Received` (implementar no MVP se tempo permitir) |
| Migrations falhando no startup | Baixa | Alto | `migrate.exe` ou `Database.MigrateAsync()` no startup com retry |
| Divergência em cálculos decimais | Baixa | Alto | Usar `decimal` em C# e `numeric(18,2)` no PostgreSQL; nunca `double` ou `float` |
