# RECIX MVP Reliability Gate

Este documento define o gate técnico obrigatório para release do MVP.

## Princípio base

Se o sistema puder errar o dinheiro, o release falha.

## Checklist bloqueante (PASS/FAIL)

### 1) Ingestão de eventos
- [ ] Evento persistido antes do processamento
- [ ] `rawPayload` salvo integralmente
- [ ] `createdAt` registrado
- [ ] `eventId` único por evento

### 2) Idempotência e concorrência
- [ ] Índice único em `event_id`
- [ ] Duplicado retorna `IgnoredDuplicate`
- [ ] Violação de chave única tratada explicitamente
- [ ] Mesmo webhook 5x simultaneamente não duplica registro

### 3) Processamento assíncrono
- [ ] Fluxo `Received -> Processing -> Processed|Failed`
- [ ] Eventos travados em `Processing` são recuperados
- [ ] Eventos `Failed` entram em retry automático
- [ ] Falha é registrada em log com motivo técnico

### 4) Auditoria e rastreabilidade
- [ ] Histórico de `PaymentEvent` preservado
- [ ] Histórico de `ReconciliationResult` preservado
- [ ] Cada pagamento explica o resultado de conciliação

### 5) Conciliação financeira
- [ ] Sempre existe `ReconciliationResult` após processamento
- [ ] Tipos cobertos: `Matched`, `AmountMismatch`, `DuplicatePayment`,
      `PaymentWithoutCharge`, `ExpiredChargePaid`, `InvalidReference`,
      `ProcessingError`

### 6) Observabilidade mínima
- [ ] Métricas de pipeline disponíveis em `/events/metrics`
- [ ] Contadores mínimos: `received`, `processed`, `failed`, `duplicates`, `stuckRecovered`

## Evidências de implementação (código)

- Idempotência/ingestão: `src/Recix.Application/UseCases/ReceivePixWebhookUseCase.cs`
- Tratamento de duplicate key: `src/Recix.Infrastructure/Repositories/PaymentEventRepository.cs`
- Processamento/retry/watchdog: `src/Recix.Infrastructure/BackgroundServices/PaymentEventProcessorService.cs`
- Métricas: `src/Recix.Application/Services/PaymentReliabilityMetrics.cs`
- Exposição de métricas: `src/Recix.Api/Endpoints/EventEndpoints.cs`

## Testes de gate

- `tests/Recix.Tests/Application/ReceivePixWebhookUseCaseTests.cs`
  - valida deduplicação
  - valida concorrência com 5 envios simultâneos
- `tests/Recix.Tests/Application/ProcessPaymentEventUseCaseTests.cs`
  - valida cenários de conciliação e transições de status

## Comando de verificação

```bash
dotnet test
```
