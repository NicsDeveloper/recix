# Decisions — RECIX Engine MVP

Registro de decisões de design tomadas durante o desenvolvimento. Cada entrada justifica uma escolha não óbvia.

---

## D001 — `Money` como `decimal` simples, não Value Object

**Data:** 2026-04-29  
**Decisão:** Usar `decimal` para valores monetários em vez de criar um Value Object `Money`.  
**Motivo:** Para o MVP com uma única moeda (BRL) e sem necessidade de conversão ou formatação avançada, o overhead de um VO não agrega. A decisão pode ser revisada se multi-moeda for adicionada.

---

## D002 — `ReferenceId` gerado na Application, não no Domain

**Data:** 2026-04-29  
**Decisão:** A geração do `ReferenceId` (ex: `RECIX-20260429-000001`) ocorre no use case `CreateChargeUseCase`, não na entidade `Charge`.  
**Motivo:** A geração requer acesso ao banco (para contar cobranças do dia) e à data atual, o que são infraestrutura/tempo — fora do domínio puro. A entidade apenas recebe o valor já gerado.

---

## D003 — Sem recovery automático de eventos presos em `Processing`

**Data:** 2026-04-29  
**Decisão:** No MVP, eventos com status `Processing` que fiquem presos (ex: crash do servidor) não são recuperados automaticamente.  
**Motivo:** Adicionar lógica de timeout/recovery aumenta a complexidade. Em produção, isso seria necessário. Documentado como risco em technical-spec.md.

---

## D004 — Sem testes de integração HTTP no MVP

**Data:** 2026-04-29  
**Decisão:** Não há testes usando `WebApplicationFactory` ou similares.  
**Motivo:** O escopo do MVP cobre testes de domínio e aplicação. Testes de integração HTTP são valiosos mas aumentariam o tempo de setup significativamente. O arquivo `.http` serve como validação manual.

---

## D005 — BackgroundService faz polling a cada 5 segundos

**Data:** 2026-04-29  
**Decisão:** O `PaymentEventProcessorService` verifica eventos pendentes a cada 5 segundos via `Task.Delay`.  
**Motivo:** Sem mensageria (RabbitMQ/Kafka está fora de escopo), polling periódico é a solução mais simples. Em produção, seria substituído por um consumer de fila.

---

## D006 — FakeAiInsightService como implementação padrão

**Data:** 2026-04-29  
**Decisão:** A implementação registrada no DI é `FakeAiInsightService`. Para usar Ollama ou OpenAI, trocar o registro no `Program.cs`.  
**Motivo:** Manter o MVP funcional sem dependências externas de IA. A interface `IAiInsightService` garante que a troca seja trivial.

---
 
## D007 — “Dashboard Overview” como modelo único para a UI

**Data:** 2026-04-29  
**Decisão:** A UI do dashboard consumirá `GET /dashboard/overview` como fonte única para reunir summary, séries, itens recentes e alertas.

---

## D008 — Semântica do “Fluxo Financeiro” (`fluxSeries`)

**Data:** 2026-04-29  
**Decisão:** A série é calculada como:
- `received`: soma acumulada (ou por bucket) de valores das cobranças com `ChargeStatus.Paid`;
- `divergent`: soma acumulada (ou por bucket) de valores das cobranças com `ChargeStatus.Divergent`;
- `expected = received - divergent`.

**Motivo:** Mantém coerência com os totais já existentes em `DashboardQueryService.GetSummaryAsync` (onde “Valor Recebido” e “Valor Divergente” são diretamente derivados dos statuses da `Charge`).

---

## D009 — Cálculo do “há X minutos” e ordenação dos “últimos”

**Data:** 2026-04-29  
**Decisão:** 
- “há X minutos” em `alerts.lastDetectedAt` usa `createdAt` do `ReconciliationResult` que originou a divergência/alerta.
- “Últimas Conciliações” é ordenado por `ReconciliationResult.createdAt` decrescente.
- “Recebido em” (tabela de eventos) usa `PaymentEvent.paidAt`.

---

## D010 — Bucketing temporal do gráfico (MVP)

**Data:** 2026-04-29  
**Decisão:** O número de pontos em `fluxSeries` será fixo (ex.: 8 pontos). Se o intervalo (`fromDate`→`toDate`) cobrir até 24 horas, os buckets serão por hora; caso contrário, por dia.

**Motivo:** Mantém o gráfico legível e estável para pixel-perfect, evitando variações de escala/quantidade de pontos.
