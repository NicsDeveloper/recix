# Product Spec — RECIX Engine MVP

## Visão do Produto

RECIX Engine é uma engine local de processamento financeiro em tempo real para simular recebimentos via PIX, processar webhooks, reconciliar pagamentos e identificar divergências financeiras.

O sistema não se integra com bancos reais ou PSPs reais. Toda a simulação é local, permitindo ao time de engenharia validar fluxos de pagamento, conciliação e auditoria sem dependências externas.

---

## Problema

Sistemas financeiros que processam PIX precisam lidar com:
- Webhooks chegando fora de ordem ou duplicados.
- Pagamentos com valor divergente do cobrado.
- Cobranças expiradas recebendo pagamentos tardios.
- Pagamentos sem cobrança correspondente.
- Necessidade de rastreabilidade e auditoria de cada evento.

Sem uma engine de conciliação robusta, esses casos geram inconsistências silenciosas, perda de dinheiro ou bloqueios operacionais.

---

## Objetivo do MVP

Provar tecnicamente o seguinte fluxo ponta a ponta:

1. Criar uma cobrança PIX fake.
2. Receber eventos de pagamento via webhook fake.
3. Processar eventos de forma segura, idempotente e auditável.
4. Conciliar cobrança esperada versus pagamento recebido.
5. Identificar inconsistências: pagamento duplicado, valor divergente, pagamento sem cobrança, pagamento após expiração.
6. Expor APIs para consulta e auditoria.
7. Ter uma camada de IA fake para explicar divergências e resumir problemas financeiros.

---

## Personas

### Engenheiro de Backend
- Usa a engine para validar fluxos de pagamento localmente.
- Precisa de APIs claras, logs estruturados e comportamento previsível.
- Quer poder simular todos os cenários de divergência sem dependências externas.

### Tech Lead / Arquiteto
- Avalia a qualidade da arquitetura para decidir se é base para produção.
- Precisa verificar separação de responsabilidades, idempotência e resiliência.
- Quer ver testes que cobrem regras de domínio críticas.

### Analista Financeiro (usuário futuro)
- Consulta cobranças, pagamentos e divergências.
- Quer entender por que um pagamento foi marcado como divergente.
- Não interage com código; usa interface ou API para consultar dados.

---

## Escopo do MVP

### Funcionalidades incluídas

- Criar cobrança PIX fake com valor e prazo de expiração.
- Receber webhook fake de pagamento PIX.
- Detectar e ignorar webhooks duplicados (idempotência por EventId).
- Processar eventos de forma assíncrona via BackgroundService.
- Conciliar pagamento com cobrança nos seguintes cenários:
  - Pagamento correto → Matched
  - Valor divergente → AmountMismatch
  - Pagamento duplicado → DuplicatePayment
  - Sem cobrança correspondente → PaymentWithoutCharge
  - Cobrança expirada → ExpiredChargePaid
  - Referência inválida → InvalidReference
- Listar cobranças com paginação e filtros.
- Listar eventos de pagamento.
- Listar resultados de conciliação com filtros.
- Dashboard com resumo financeiro.
- Explicação de divergência via IA fake.
- Resumo diário via IA fake.
- Arquivo `.http` com exemplos de todos os cenários.
- Testes unitários e de aplicação.
- Docker Compose para subir tudo localmente.

### Stack obrigatória

- .NET 9, C#, Minimal API
- Clean Architecture
- Entity Framework Core + PostgreSQL
- BackgroundService para processamento assíncrono
- Docker Compose

---

## Fora de Escopo

- PIX real ou integração com bancos/PSPs reais.
- Autenticação e autorização (JWT, OAuth).
- Multi-tenancy.
- Frontend (UI web/mobile).
- Mensageria externa (RabbitMQ, Kafka, SQS).
- Antifraude avançado.
- Deploy em cloud (AWS, Azure, GCP).
- Kubernetes / orquestração de containers.
- Notificações (e-mail, SMS, push).
- Relatórios PDF/Excel.
- IA real (Ollama/OpenAI) — apenas interface preparada para extensão futura.

---

## Critérios de Sucesso

O MVP estará pronto quando:

1. `docker compose up` sobe toda a infraestrutura sem erros.
2. Swagger acessível em `http://localhost:5000/swagger`.
3. Criação de cobrança via `POST /charges` funciona e persiste no banco.
4. Webhook fake via `POST /webhooks/pix` é recebido, salvo e enfileirado.
5. Webhook duplicado retorna status `IgnoredDuplicate` sem gerar nova conciliação.
6. BackgroundService processa eventos de forma assíncrona.
7. Todos os 6 cenários de conciliação funcionam corretamente.
8. `GET /dashboard/summary` retorna resumo financeiro correto.
9. `GET /ai/reconciliations/{id}/explanation` retorna explicação coerente.
10. Testes unitários e de aplicação passam (`dotnet test`).
