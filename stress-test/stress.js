/**
 * Recix Engine — k6 Stress Test
 *
 * Phases:
 *   1. Warmup   :  10s ramp  0→10 VUs
 *   2. Sustain  :  60s hold  10 VUs
 *   3. Spike    :  20s ramp  10→50 VUs
 *   4. Recovery :  30s ramp  50→5 VUs
 *
 * Scenarios tested per VU iteration:
 *   - POST /charges           (create charge)
 *   - POST /webhooks/pix      (exact-match by referenceId)
 *   - POST /webhooks/pix      (amount-mismatch divergence)
 *   - POST /webhooks/pix      (unknown reference — PaymentWithoutCharge)
 *   - GET  /charges           (list)
 *   - GET  /reconciliations/summary
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

// ── Config ────────────────────────────────────────────────────────────────────
const BASE = 'http://localhost:5000'
const TOKEN = __ENV.TOKEN   // passed via -e TOKEN=...

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
}

// ── Custom metrics ────────────────────────────────────────────────────────────
const chargeCreated    = new Counter('charge_created')
const webhookMatched   = new Counter('webhook_matched')
const webhookDivergent = new Counter('webhook_divergent')
const webhookUnknown   = new Counter('webhook_unknown')
const errorRate        = new Rate('error_rate')
const chargeLatency    = new Trend('charge_latency_ms')
const webhookLatency   = new Trend('webhook_latency_ms')

// ── Test options ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 10  }, // warmup
    { duration: '60s', target: 10  }, // sustain
    { duration: '20s', target: 50  }, // spike
    { duration: '30s', target: 5   }, // recovery
  ],
  thresholds: {
    http_req_failed:   ['rate<0.05'],       // <5% failure
    http_req_duration: ['p(95)<2000'],      // 95th percentile < 2s
    error_rate:        ['rate<0.05'],
    charge_latency_ms: ['p(95)<1500'],
    webhook_latency_ms:['p(95)<1500'],
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function isoNow() {
  return new Date().toISOString()
}

// ── Main scenario ─────────────────────────────────────────────────────────────
export default function () {
  // 1. Create a charge
  const amount = Math.round((Math.random() * 990 + 10) * 100) / 100 // 10–1000
  const createRes = http.post(
    `${BASE}/charges`,
    JSON.stringify({ amount, expiresInMinutes: 60 }),
    { headers }
  )
  chargeLatency.add(createRes.timings.duration)

  const ok201 = check(createRes, { 'charge created 201': r => r.status === 201 })
  errorRate.add(!ok201)

  if (!ok201) {
    sleep(0.5)
    return
  }
  chargeCreated.add(1)

  const charge = createRes.json()

  // 2. Exact-match webhook (should reconcile → Paid / FullyPaid)
  const matchedRes = http.post(
    `${BASE}/webhooks/pix`,
    JSON.stringify({
      eventId:    uuid(),
      referenceId: charge.referenceId,
      paidAmount:  charge.amount,
      paidAt:      isoNow(),
      provider:    'SimuladorK6',
    }),
    { headers }
  )
  webhookLatency.add(matchedRes.timings.duration)
  const okMatch = check(matchedRes, { 'webhook accepted/ok': r => r.status === 202 || r.status === 200 })
  errorRate.add(!okMatch)
  if (okMatch) webhookMatched.add(1)

  sleep(0.2)

  // 3. Amount-mismatch divergence (different charge, partial payment)
  const createRes2 = http.post(
    `${BASE}/charges`,
    JSON.stringify({ amount: 200.00, expiresInMinutes: 60 }),
    { headers }
  )
  if (createRes2.status === 201) {
    const charge2 = createRes2.json()
    const mismatchRes = http.post(
      `${BASE}/webhooks/pix`,
      JSON.stringify({
        eventId:    uuid(),
        referenceId: charge2.referenceId,
        paidAmount:  100.00,   // half — divergent
        paidAt:      isoNow(),
        provider:    'SimuladorK6',
      }),
      { headers }
    )
    webhookLatency.add(mismatchRes.timings.duration)
    const okDiv = check(mismatchRes, { 'divergent webhook accepted': r => r.status === 202 || r.status === 200 })
    if (okDiv) webhookDivergent.add(1)
  }

  sleep(0.2)

  // 4. Unknown reference → PaymentWithoutCharge
  const unknownRes = http.post(
    `${BASE}/webhooks/pix`,
    JSON.stringify({
      eventId:     uuid(),
      referenceId: `UNKNOWN-${uuid()}`,
      paidAmount:  50.00,
      paidAt:      isoNow(),
      provider:    'SimuladorK6',
    }),
    { headers }
  )
  webhookLatency.add(unknownRes.timings.duration)
  const okUnknown = check(unknownRes, { 'unknown ref accepted': r => r.status === 202 || r.status === 200 })
  if (okUnknown) webhookUnknown.add(1)

  sleep(0.2)

  // 5. GET /charges (read path under load)
  const listRes = http.get(`${BASE}/charges?pageSize=20`, { headers })
  check(listRes, { 'list charges 200': r => r.status === 200 })

  // 6. GET /dashboard/summary
  const summaryRes = http.get(`${BASE}/dashboard/summary`, { headers })
  check(summaryRes, { 'dashboard summary 200': r => r.status === 200 })

  sleep(0.3)
}
