# Frontend UI/UX Spec — RECIX Engine MVP

## Layout Geral

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (240px fixo)  │  Main Content Area             │
│                        │  ┌─────────────────────────┐   │
│  [Logo RECIX]          │  │ Header (title + actions) │   │
│                        │  └─────────────────────────┘   │
│  Nav items:            │  Page Content (light)        │
│  • Dashboard           │                                 │
│  • Cobranças           │                                 │
│  • Eventos de Pagamento│                                 │
│  • Conciliações        │                                 │
│  • Divergências        │                                 │
│  • Simulador           │                                 │
│                        │                                 │
│  Rodapé (status/v.)   │                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Navegação (Sidebar)

Items:
- **Dashboard** — ícone `LayoutDashboard` — rota `/`
- **Cobranças** — ícone `CreditCard` — rota `/charges`
- **Eventos de Pagamento** — ícone `Webhook` (ou `Zap`) — rota `/payment-events`
- **Conciliações** — ícone `GitMerge` (ou `Scale`) — rota `/reconciliations`
- **Divergências** — ícone `AlertTriangle` — rota `/reconciliations?status=AmountMismatch` (foco visual no MVP)
- **Simulador PIX** — ícone `PlayCircle` — rota `/webhooks/simulator` (badge `Novo`)
- **Relatórios** — ícone `FileText` — placeholder visual (sem rota no MVP)
- **Alertas** — ícone `Bell` — placeholder visual (sem rota no MVP)
- **Conexões** — ícone `Wifi` — placeholder visual (sem rota no MVP)
- **Configurações** — ícone `Settings` — placeholder visual (sem rota no MVP)

Item ativo: highlight com `bg-green-500/10 text-green-500 border-l-2 border-green-500/30`

Rodapé da sidebar:
- Título: `Sistema Operacional`
- Subtexto: `Todos os serviços online`
- Versão: `MVP 1.0.0`
- Usuário: `Dev Recix - Administrador`

O título/subtexto devem refletir o health da API (verde = online, vermelho = offline), mas mantendo o microcopy acima como prioridade visual.

---

## Header

Conteúdo:
- Breadcrumb textual (ex: "Dashboard", "Cobranças / Detalhes")
- Botão de ação principal da página (ex: "Nova Cobrança" em `/charges`)
- Botão de refresh opcional

---

## Páginas

---

### Dashboard (`/`)

**Header da página:**
- Título: `Dashboard`
- Subtítulo: `Visão geral da saúde financeira em tempo real`
- Date picker (faixa): `DD/MM/YYYY - DD/MM/YYYY`
- Texto à direita: `Atualizado há Xs`
- Botão primário: `Simular Evento` (rota `/webhooks/simulator`)

**KPI cards (linha 1 — 6 cards horizontais):**
- 1) `Total de Cobranças`: valor numérico + subtítulo `+X% vs período anterior`
- 2) `Cobranças Pagas`: valor numérico + `X%` (mini gráfico verde)
- 3) `Cobranças Pendentes`: valor numérico + `X%` (mini gráfico amarelo)
- 4) `Cobranças Divergentes`: valor numérico + `X%` (mini gráfico vermelho)
- 5) `Valor Total Recebido`: `R$` + subtítulo `Em pagamentos`
- 6) `Valor Divergente`: `R$` + subtítulo `Em divergências`

Cards:
- ícone outline à esquerda
- padding médio
- borda suave e shadow leve

**Seção (linha 2 — 3 colunas):**

**Coluna esquerda — Donut Chart:**
- Título: `Visão Geral de Conciliações`
- Donut com centro: `{totalCharges} Total`
- Legenda (cores semânticas):
  - `Matched` (verde)
  - `AmountMismatch` (vermelho)
  - `DuplicatePayment` (laranja)
  - `PaymentWithoutCharge` (vermelho claro)
  - `ExpiredChargePaid` (amarelo)
  - `InvalidReference` (roxo)
  - `ProcessingError` (cinza)
- Botão: `Ver todas as conciliações` (rota `/reconciliations`)

**Coluna centro — Problemas Detectados:**
- Lista vertical com 4 itens:
  1) Amount Mismatch
  2) Duplicate Payment
  3) Payment Without Charge
  4) Expired Charge Paid
- Cada item:
  - ícone
  - descrição curta
  - barra horizontal proporcional
  - valor numérico + percentual

**Coluna direita — Fluxo Financeiro:**
- Gráfico de linha (Recharts):
  - `Recebido` (verde)
  - `Esperado` (azul)
  - `Divergente` (vermelho)
- Resumo abaixo do gráfico:
  - `Recebido: R$ ...`
  - `Esperado: R$ ...`
  - `Divergente: R$ ...`

**Linha 3 — Tabelas:**
1) `Últimas Conciliações`
   - Status (badge colorido)
   - Cobrança (`REF...`)
   - Pagamento (`EVT...`)
   - Valor Esperado
   - Valor Pago
   - Data
2) `Últimos Eventos de Pagamento`
   - EventId
   - Referência
   - Valor Pago
   - Provedor
   - Status (`Processed`)
   - Recebido em

**Rodapé/linha final — Alertas (cards horizontais):**
- 1) `Divergência de Valor`
- 2) `Pagamentos Duplicados`
- 3) `Pagamentos sem Cobrança`

Cada card:
- ícone
- descrição curta
- tempo `há X minutos`
- botão `Ver detalhes` (leva a `/reconciliations?status=<ReconciliationStatus>`)

---

### Cobranças (`/charges`)

**Barra de ações:**
- Filtro por status (dropdown ou tab pills)
- Busca por texto (ReferenceId / ExternalId)
- Botão "Nova Cobrança" → abre `CreateChargeModal`

**Tabela:**

| ReferenceId | Amount | Status | ExpiresAt | CreatedAt | Ações |
|---|---|---|---|---|---|
| RECIX-... | R$ 150,75 | `[Pending]` | 29/04 00:47 | 29/04 00:17 | 👁 |

- `StatusBadge` colorido na coluna Status
- Clique na linha ou no ícone de olho → navega para `/charges/:id`
- Formatação monetária em BRL
- Datas em `dd/MM/yyyy HH:mm`

---

### Detalhe da Cobrança (`/charges/:id`)

**Seção superior — dados da cobrança:**
```
┌─────────────────────────────────────────────────┐
│ RECIX-20260429-000001              [Paid] verde  │
│ R$ 150,75                                       │
│ Expira em: 29/04/2026 00:47                     │
│ Criado em: 29/04/2026 00:17                     │
│ ExternalId: fakepsp_abc123...                   │
└─────────────────────────────────────────────────┘
```

**Seção inferior — conciliações relacionadas:**
Tabela simplificada das `ReconciliationResult` com `chargeId == id`
- Status | Reason | PaidAmount | ExpectedAmount | CreatedAt | [Explicar IA]

---

### Eventos de Pagamento (`/payment-events`)

**Barra de ações:**
- Filtro por status
- Busca por EventId / ReferenceId / ExternalChargeId
- Botão "Enviar Webhook Fake" → abre `SendWebhookModal`

**Tabela:**

| EventId | PaidAmount | Provider | Status | PaidAt | ProcessedAt |
|---|---|---|---|---|---|

- `StatusBadge` colorido
- EventId truncado com tooltip no full

---

### Simulador PIX (`/webhooks/simulator`)

**Form centralizado:**
```
┌──────────────────────────────────────────┐
│ Simular Pagamento PIX                    │
│                                          │
│ EventId        [gerar automático 🔄]     │
│ ExternalChargeId  [_________________]    │
│ ReferenceId       [_________________]    │
│ Valor Pago        [_________________]    │
│ Data/Hora Pag.    [now por default]      │
│ Provider          [FakePixProvider]      │
│                                          │
│ [Enviar Webhook]                         │
└──────────────────────────────────────────┘
```

**Seção de cenários pré-configurados (atalhos):**
- "Pagamento Correto" — preenche form com valores sugeridos
- "Valor Divergente" — preenche com amount diferente
- "Sem Cobrança" — preenche com ExternalId inválido
- "Duplicado" — preenche com EventId já usado

**Feedback após envio:**
- Success toast se `status === 'Received'`
- Warning toast se `status === 'IgnoredDuplicate'`
- Error toast se 400/500

---

### Conciliações (`/reconciliations`)

**Barra de filtros:**
- Status dropdown
- ChargeId input (opcional)
- PaymentEventId input (opcional)

**Tabela:**

| Status | Reason (truncado) | Expected | Paid | Charge | CreatedAt | Ações |
|---|---|---|---|---|---|---|
| `[Matched]` | Payment matched... | R$ 150,75 | R$ 150,75 | link | 29/04 | — |
| `[AmountMismatch]` | Paid 140,00 differs... | R$ 150,75 | R$ 140,00 | link | 29/04 | [🤖 Explicar] |

- Botão "Explicar" abre `AiExplanationModal` apenas para status divergentes
- ChargeId exibe link clicável para `/charges/:id`

---

## Componentes

### `StatusBadge`

```tsx
<StatusBadge status="Paid" />
// Renderiza: pill com cor semântica + texto
```

Mapeamento de cores:

**ChargeStatus:**
- `Pending` → `bg-yellow-500/10 text-yellow-400 border-yellow-500/20`
- `Paid` → `bg-green-500/10 text-green-400 border-green-500/20`
- `Expired` → `bg-gray-500/10 text-gray-400 border-gray-500/20`
- `Divergent` → `bg-red-500/10 text-red-400 border-red-500/20`
- `Cancelled` → `bg-gray-600/10 text-gray-500 border-gray-600/20`

**PaymentEventStatus:**
- `Received` → `bg-blue-500/10 text-blue-400 border-blue-500/20`
- `Processing` → `bg-yellow-500/10 text-yellow-400 border-yellow-500/20`
- `Processed` → `bg-green-500/10 text-green-400 border-green-500/20`
- `Failed` → `bg-red-500/10 text-red-400 border-red-500/20`
- `IgnoredDuplicate` → `bg-purple-500/10 text-purple-400 border-purple-500/20`

**ReconciliationStatus:**
- `Matched` → verde
- `AmountMismatch` → vermelho
- `DuplicatePayment` → laranja
- `PaymentWithoutCharge` → vermelho
- `ExpiredChargePaid` → laranja
- `InvalidReference` → vermelho
- `ProcessingError` → vermelho

---

### `StatCard`

```tsx
<StatCard
  title="Cobranças Pagas"
  value={35}
  icon={<CheckCircle />}
  trend="success"
/>
```

Props: `title`, `value`, `subtitle?`, `icon`, `trend?: 'success' | 'warning' | 'danger' | 'neutral'`

---

### `MoneyText`

```tsx
<MoneyText value={150.75} /> // → R$ 150,75
```

Usa `Intl.NumberFormat` com locale `pt-BR` e currency `BRL`.

---

### `DateTimeText`

```tsx
<DateTimeText value="2026-04-29T00:17:00Z" /> // → 29/04/2026 00:17
```

---

### `DataTable`

```tsx
<DataTable
  columns={columns}
  data={items}
  isLoading={isLoading}
  emptyMessage="Nenhuma cobrança encontrada."
/>
```

Colunas definidas como array de objetos com `key`, `header`, `render`.

---

### `CreateChargeModal`

- Campos: `amount` (number), `expiresInMinutes` (number)
- Validação inline: amount > 0, expiresInMinutes > 0
- Botão disabled durante loading
- Após sucesso: fecha modal, exibe toast, invalida query de charges

---

### `SendWebhookModal`

- Campos: `eventId`, `externalChargeId`, `referenceId`, `paidAmount`, `paidAt`, `provider`
- `eventId` com botão "Gerar" que preenche `evt_${Date.now()}`
- `paidAt` default: now em formato ISO
- `provider` default: `FakePixProvider`
- Feedback visual por status retornado

---

### `AiExplanationModal`

- Header: "Explicação da IA" + badge do status da conciliação
- Body: texto da explicação em `font-mono`-free, estilo parágrafo
- Footer: modelo de IA usado (`FakeAiInsightService/1.0`)
- Nota visual: *"A IA explica dados processados e não altera registros."*

---

## Estados Visuais

### LoadingState
- Spinner `animate-spin` centralizado
- Mensagem "Carregando..."

### ErrorState
- Ícone `AlertCircle` vermelho
- Mensagem de erro
- Botão "Tentar novamente"

### EmptyState
- Ícone contextual (ex: `Inbox`, `CreditCard`)
- Mensagem amigável
- CTA opcional (ex: "Criar primeira cobrança")

---

## Microcopy

- Botão criar: **"Nova Cobrança"**
- Botão enviar webhook: **"Enviar Webhook Fake"**
- Botão IA: **"Explicar com IA"**
- Confirmação de criação: **"Cobrança criada com sucesso! ReferenceId: RECIX-..."**
- Webhook recebido: **"Webhook enviado. Aguardando processamento..."**
- Webhook duplicado: **"Evento duplicado detectado (IgnoredDuplicate)."**
- Loading: **"Carregando..."**
- Erro de rede: **"Não foi possível conectar à API. Verifique se o backend está rodando."**
- Lista vazia de cobranças: **"Nenhuma cobrança encontrada. Crie uma para começar."**
- Lista vazia de conciliações: **"Nenhuma conciliação registrada ainda."**

---

## Experiência Esperada

Ao abrir o sistema pela primeira vez (banco zerado):
- Dashboard exibe todos os cards com `0`
- Tabelas exibem EmptyState com mensagem e CTA

Após criar cobranças e enviar webhooks:
- Dashboard atualiza automaticamente (ou via botão de refresh)
- Tabelas mostram dados em tempo real
- Badges de status mudam conforme processamento

Durante demo:
- Fluxo completo possível em < 3 minutos
- Nenhuma tela quebra (sem erros não tratados)
- Visual consistente e profissional em todas as páginas
