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
