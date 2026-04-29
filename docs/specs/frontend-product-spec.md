# Frontend Product Spec — RECIX Engine MVP

## Visão do Frontend

Interface operacional web para o RECIX Engine — um painel financeiro que permite visualizar em tempo real o estado das cobranças PIX, eventos de pagamento, conciliações automáticas e divergências identificadas pela engine.

O frontend não é um produto de consumo. É uma **ferramenta de operação e demonstração** — projetada para engenheiros, analistas financeiros e tech leads que precisam entender, validar e apresentar o comportamento da engine.

---

## Objetivos da Interface

1. **Visibilidade imediata** do estado financeiro da engine (dashboard).
2. **Rastreabilidade** de cada cobrança, evento e conciliação.
3. **Simulação de cenários** — criar cobranças e enviar webhooks fake sem CLI ou Postman.
4. **Auditoria amigável** — ver motivos de divergências sem precisar de SQL.
5. **Explicações de IA** acessíveis diretamente na interface.
6. **Demo-ready** — fluxo completo demonstrável em menos de 3 minutos para stakeholders.

---

## Personas

### Engenheiro de Backend
- Quer verificar que os webhooks foram processados e conciliados corretamente.
- Usa a interface para debugar cenários sem precisar de curl.
- Precisa ver logs de status de processamento.

### Tech Lead / Arquiteto
- Quer demonstrar o MVP para o time ou stakeholders.
- Segue o fluxo de demo ponta a ponta na interface.
- Avalia qualidade técnica e visual do produto.

### Analista Financeiro (usuário futuro)
- Quer entender por que um pagamento foi marcado como divergente.
- Precisa de linguagem simples, não técnica.
- Usa explicações de IA para interpretar resultados.

---

## Principais Dores que a UI Resolve

| Dor | Solução |
|-----|---------|
| "Preciso de curl/Postman para simular PIX" | Modal de criação de cobrança e envio de webhook na própria UI |
| "Não sei se o webhook foi processado" | Tabela de Payment Events com status em tempo real |
| "Por que essa cobrança ficou Divergent?" | Botão de explicação de IA diretamente na linha da conciliação |
| "Quero uma visão geral do sistema rapidamente" | Dashboard com cards, valores e gráfico de distribuição |
| "Preciso demonstrar o sistema para alguém" | Fluxo de demo completo navegável em < 3 minutos |

---

## Escopo do MVP Frontend

### Páginas incluídas
- `/` — Dashboard com summary, cards financeiros e gráfico
- `/charges` — Lista de cobranças com filtros e criação
- `/charges/:id` — Detalhe da cobrança com conciliações relacionadas
- `/payment-events` — Lista de eventos de pagamento com filtros
- `/reconciliations` — Lista de conciliações com filtros e explicação de IA
- `/webhooks/simulator` — Simulador de webhook PIX fake

### Funcionalidades incluídas
- Cards financeiros do dashboard
- Gráfico de distribuição por status de conciliação
- Tabelas paginadas com filtros por status
- Modal de criação de cobrança (amount + expiresInMinutes)
- Modal/form de envio de webhook fake
- Modal de explicação de IA por conciliação
- StatusBadge visual para cada tipo de status
- Formatação de moeda (BRL) e datas
- Loading, erro e empty states em todas as telas
- Layout com sidebar de navegação

---

## Fora de Escopo

- Autenticação / login
- Permissões e roles
- Multi-tenancy
- Edição ou exclusão de cobranças
- Notificações em tempo real (WebSocket)
- Internacionalização
- Tema customizável (dark/light toggle)
- Deploy e CI/CD
- Testes E2E
- Configurações avançadas do sistema

---

## Jornadas Principais

### Jornada 1 — Visão geral operacional
1. Abre `/` (Dashboard)
2. Lê cards: total, pagas, pendentes, divergentes
3. Vê gráfico de distribuição de conciliações
4. Identifica se há problemas (AmountMismatch, Duplicate, etc.)

### Jornada 2 — Simular pagamento correto
1. Vai para `/charges`
2. Clica em "Nova Cobrança" → preenche amount e expiresInMinutes → cria
3. Copia o ExternalId gerado
4. Vai para `/webhooks/simulator` (ou abre modal)
5. Preenche webhook com ExternalId correto e valor idêntico
6. Envia → vê `Received`
7. Aguarda ~5s → recarrega → vê cobrança `Paid` e conciliação `Matched`

### Jornada 3 — Demonstrar divergência
1. Cria nova cobrança de R$ 200
2. Envia webhook com valor diferente (R$ 180)
3. Vê cobrança `Divergent` e conciliação `AmountMismatch`
4. Vai para `/reconciliations`
5. Clica em "Explicar" na conciliação divergente
6. Lê explicação de IA em linguagem simples

### Jornada 4 — Auditoria de evento
1. Vai para `/payment-events`
2. Filtra por status `Failed` ou `IgnoredDuplicate`
3. Vê detalhes do evento: EventId, Provider, PaidAmount, timestamps

---

## Critérios de Sucesso

1. `npm install && npm run dev` funciona sem erros.
2. `npm run build` produz build sem erros.
3. `VITE_API_BASE_URL` configurável via `.env`.
4. Dashboard carrega e exibe dados reais da API.
5. Criação de cobrança via modal funciona.
6. Envio de webhook fake via form funciona.
7. Tabelas de cobranças, eventos e conciliações funcionam com filtros.
8. Explicação de IA abre e exibe texto.
9. Loading, erro e empty state visíveis em todas as telas.
10. Visual profissional de fintech SaaS (não parece protótipo).
