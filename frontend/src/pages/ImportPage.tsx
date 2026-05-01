import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  Upload, CheckCircle, XCircle, Copy,
  FileText, ChevronRight, ArrowRight,
  ShoppingCart, Building2, GitMerge, Info, Download,
  HelpCircle,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import type { ImportStatementResult, ImportSalesResult } from '../types'
import { importService } from '../services/importService'

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Info size={14} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-gray-200">Como funciona a conciliação</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            step: '1',
            icon: <ShoppingCart size={20} className="text-indigo-400" />,
            bg: 'bg-indigo-500/10',
            title: 'Importe suas vendas',
            body: 'CSV com valor e descrição de cada venda. Cria as cobranças que o sistema espera receber.',
            tip: 'CSV com suas vendas do período.',
            tipColor: 'text-indigo-400',
          },
          {
            step: '2',
            icon: <Building2 size={20} className="text-sky-400" />,
            bg: 'bg-sky-500/10',
            title: 'Importe o extrato bancário',
            body: 'OFX do seu banco ou CSV com as transações. O Recix lê cada entrada e tenta casar com uma venda.',
            tip: 'OFX do banco ou CSV de transações.',
            tipColor: 'text-sky-400',
          },
          {
            step: '3',
            icon: <GitMerge size={20} className="text-green-400" />,
            bg: 'bg-green-500/10',
            title: 'Veja a conciliação',
            body: 'O Recix cruza automaticamente: mesmo valor? Conciliado. Valor diferente? Divergência detectada.',
            tip: 'Acesse Conciliações.',
            tipColor: 'text-green-400',
          },
        ].map((s, i) => (
          <div key={s.step} className="flex gap-3">
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                {s.icon}
              </div>
              {i < 2 && (
                <div className="hidden sm:flex flex-col items-center gap-1 py-1">
                  <div className="w-px h-4 bg-gray-700" />
                </div>
              )}
            </div>
            <div className="pt-1.5">
              <p className="text-xs font-bold text-gray-200">{s.title}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.body}</p>
              <p className={`text-[11px] font-semibold mt-1.5 ${s.tipColor}`}>{s.tip}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2 text-xs text-gray-400">
        <Info size={12} />
        <span>Importe vendas e extrato em <strong>qualquer ordem</strong>. O Recix re-concilia automaticamente quando ambos estão disponíveis.</span>
      </div>
    </div>
  )
}

// ─── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ accept, file, onFile }: {
  accept: string
  file: File | null
  onFile: (f: File) => void
}) {
  const ref  = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!accept.split(',').some(a => a.trim().replace('.', '') === ext)) {
      alert(`Formatos aceitos: ${accept}`)
      return
    }
    onFile(f)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      onClick={() => !file && ref.current?.click()}
      className={[
        'rounded-xl border-2 border-dashed p-8 text-center transition-all',
        drag        ? 'border-indigo-500 bg-indigo-500/5 cursor-copy'   :
        file        ? 'border-green-500/40 bg-green-500/5 cursor-default' :
                      'border-gray-700 hover:border-indigo-500/50 hover:bg-indigo-500/5 cursor-pointer',
      ].join(' ')}
    >
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      {file ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <FileText size={22} className="text-green-400" />
          </div>
          <p className="text-sm font-semibold text-green-400">{file.name}</p>
          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
          <button
            onClick={e => { e.stopPropagation(); ref.current?.click() }}
            className="text-xs text-gray-600 hover:text-gray-400 underline mt-1"
          >
            Trocar arquivo
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
            <Upload size={22} className="text-gray-500" />
          </div>
          <p className="text-sm text-gray-300">Arraste o arquivo aqui ou clique para selecionar</p>
          <p className="text-xs text-gray-600">{accept.toUpperCase().replace(/\./g, '').replace(/,/g, ', ')}</p>
          <button
            onClick={e => { e.stopPropagation(); ref.current?.click() }}
            className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
          >
            Selecionar arquivo
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Column guide card ─────────────────────────────────────────────────────────

function ColGuide({ cols, template, filename }: {
  cols: { name: string; required: boolean; example: string }[]
  template: string
  filename: string
}) {
  function download() {
    const blob   = new Blob([template], { type: 'text/csv;charset=utf-8' })
    const url    = URL.createObjectURL(blob)
    const a      = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-300">Colunas do arquivo</h3>
        <button
          onClick={download}
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Download size={12} /> Baixar modelo
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {cols.map(c => (
          <div key={c.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700">
            <code className="text-xs text-indigo-300">{c.name.split('/')[0]}</code>
            {c.required
              ? <span className="text-[10px] text-red-400 font-bold">*</span>
              : <span className="text-[10px] text-gray-600">opcional</span>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-600 mt-2.5">Ex: <code className="text-gray-500">{cols.map(c => c.example).join(', ')}</code></p>
    </div>
  )
}

// ─── Result summary ────────────────────────────────────────────────────────────

function StatementResultSummary({ data }: { data: ImportStatementResult }) {
  const ok = data.imported > 0 && data.errors === 0
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center">
          <p className="text-2xl font-black text-green-400">{data.imported}</p>
          <p className="text-xs text-gray-500 mt-0.5">Importadas</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <p className="text-2xl font-black text-amber-400">{data.duplicates}</p>
          <p className="text-xs text-gray-500 mt-0.5">Duplicadas</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
          <p className="text-2xl font-black text-red-400">{data.errors}</p>
          <p className="text-xs text-gray-500 mt-0.5">Erros</p>
        </div>
      </div>

      {ok && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 flex items-start gap-3">
          <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-300">
              {data.imported} transação{data.imported !== 1 ? 'ões' : ''} importada{data.imported !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              O Recix está processando a conciliação. Os resultados aparecem em alguns segundos.
            </p>
          </div>
          <Link
            to="/reconciliations"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            Ver conciliações <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {data.lines.length > 0 && (
        <details className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          <summary className="px-4 py-3 text-xs font-semibold text-gray-400 cursor-pointer hover:text-gray-200 transition-colors flex items-center justify-between">
            <span>Detalhes linha a linha ({data.lines.length})</span>
            <ChevronRight size={13} className="transition-transform [[open]_&]:rotate-90" />
          </summary>
          <div className="overflow-x-auto max-h-56 overflow-y-auto border-t border-gray-800">
            <table className="w-full text-xs">
              <thead className="bg-gray-900 sticky top-0">
                <tr className="border-b border-gray-800 text-gray-500">
                  <th className="px-4 py-2 text-left w-10">#</th>
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left w-24">Status</th>
                  <th className="px-4 py-2 text-left">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map(l => (
                  <tr key={l.line} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-600 font-mono">{l.line}</td>
                    <td className="px-4 py-2 font-mono text-gray-400 truncate max-w-[160px]" title={l.eventId}>{l.eventId || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        {l.status === 'Imported'  && <CheckCircle size={12} className="text-green-400" />}
                        {l.status === 'Duplicate' && <Copy        size={12} className="text-amber-400" />}
                        {l.status === 'Error'     && <XCircle     size={12} className="text-red-400"   />}
                        <span className={{ Imported: 'text-green-400', Duplicate: 'text-amber-400', Error: 'text-red-400' }[l.status] ?? 'text-gray-400'}>
                          {l.status === 'Imported' ? 'Importada' : l.status === 'Duplicate' ? 'Duplicada' : 'Erro'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 italic">{l.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}

function SalesResultSummary({ data, onContinue }: { data: ImportSalesResult; onContinue: () => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center">
          <p className="text-2xl font-black text-green-400">{data.created}</p>
          <p className="text-xs text-gray-500 mt-0.5">Cobranças criadas</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <p className="text-2xl font-black text-amber-400">{data.skipped}</p>
          <p className="text-xs text-gray-500 mt-0.5">Ignoradas</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
          <p className="text-2xl font-black text-red-400">{data.errors}</p>
          <p className="text-xs text-gray-500 mt-0.5">Erros</p>
        </div>
      </div>

      {data.created > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex items-start gap-3">
          <CheckCircle size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-indigo-300">
              {data.created} venda{data.created !== 1 ? 's' : ''} registrada{data.created !== 1 ? 's' : ''} com sucesso
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Agora importe o extrato do seu banco para o Recix cruzar automaticamente.
            </p>
          </div>
          <button
            onClick={onContinue}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            Ir para extrato <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Bank format tips ──────────────────────────────────────────────────────────

const BANKS = [
  { name: 'Itaú',     hint: 'App → Minha Conta → Extrato → Exportar OFX',        color: '#f97316' },
  { name: 'Bradesco', hint: 'Internet Banking → Extrato → Exportar OFX',          color: '#ef4444' },
  { name: 'Nubank',   hint: 'App → Perfil → Exportar extrato (OFX)',              color: '#7c3aed' },
  { name: 'Santander',hint: 'Internet Banking → Extrato → Exportar OFX',          color: '#dc2626' },
  { name: 'BB',       hint: 'App/Internet Banking → Extrato → Exportar OFX/CSV',  color: '#eab308' },
  { name: 'Outros',   hint: 'Acesse seu internet banking e exporte o extrato OFX', color: '#6b7280' },
]

function BankTips() {
  const [active, setActive] = useState<string | null>(null)
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
        <HelpCircle size={12} /> Como exportar o OFX do seu banco
      </p>
      <div className="flex flex-wrap gap-2">
        {BANKS.map(b => (
          <button
            key={b.name}
            onClick={() => setActive(active === b.name ? null : b.name)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${active === b.name ? 'border-gray-600 bg-gray-800 text-gray-200' : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700 hover:text-gray-300'}`}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color }} />
            {b.name}
          </button>
        ))}
      </div>
      {active && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-xs text-gray-300">
          <strong className="text-gray-200">{active}:</strong> {BANKS.find(b => b.name === active)?.hint}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'sales' | 'statement'

const SALES_TEMPLATE = `valor,descricao,data
350.00,Amortecedor dianteiro,2026-05-01 09:30
120.00,Filtro de óleo,2026-05-01 10:15
89.90,Pastilha de freio,2026-05-01 14:00`

const STATEMENT_TEMPLATE = `eventId,paidAmount,paidAt,referenceId,externalChargeId,provider
evt_abc123,350.00,2026-05-01T09:35:00Z,,TX001,Banco
evt_def456,120.00,2026-05-01T10:20:00Z,,TX002,Banco`

export function ImportPage() {
  const [tab, setTab]       = useState<Tab>('sales')
  const [salesFile,    setSalesFile]    = useState<File | null>(null)
  const [statementFile, setStatementFile] = useState<File | null>(null)
  const [salesDone,    setSalesDone]    = useState(false)

  const salesMutation = useMutation<ImportSalesResult, Error, File>({
    mutationFn: importService.uploadSales,
    onSuccess: () => setSalesDone(true),
  })
  const stmtMutation = useMutation<ImportStatementResult, Error, File>({
    mutationFn: importService.uploadStatement,
  })

  function resetSales()     { setSalesFile(null);     salesMutation.reset() }
  function resetStatement() { setStatementFile(null); stmtMutation.reset()  }

  const stmtResult  = stmtMutation.data
  const salesResult = salesMutation.data

  return (
    <div>
      <Header
        title="Importar Dados"
        subtitle="Importe suas vendas e o extrato bancário para conciliar automaticamente"
      />

      <HowItWorks />

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl mb-6 w-fit">
        {([
          { id: 'sales',     label: 'Vendas',           done: salesDone },
          { id: 'statement', label: 'Extrato bancário',  done: !!stmtMutation.data },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-200',
            ].join(' ')}
          >
            {t.done && <CheckCircle size={14} className="text-green-400" />}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Passo 1: Vendas ── */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Importe suas vendas</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Arquivo CSV com as vendas do período. Cada linha vira uma cobrança que o sistema espera receber.
              </p>
            </div>

            <ColGuide
              filename="recix-vendas-modelo.csv"
              template={SALES_TEMPLATE}
              cols={[
                { name: 'valor',    required: true,  example: '350.00' },
                { name: 'descricao',required: true,  example: 'Amortecedor' },
                { name: 'data',     required: false, example: '2026-05-01 09:30' },
              ]}
            />

            <DropZone accept=".csv" file={salesFile} onFile={f => { setSalesFile(f); salesMutation.reset() }} />

            {salesFile && !salesMutation.data && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => salesMutation.mutate(salesFile)}
                  disabled={salesMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  <Upload size={15} />
                  {salesMutation.isPending ? 'Importando...' : 'Registrar vendas'}
                </button>
                <button onClick={resetSales} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  Limpar
                </button>
              </div>
            )}

            {salesMutation.error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex gap-2 text-sm text-red-400">
                <XCircle size={15} className="flex-shrink-0 mt-0.5" /> {salesMutation.error.message}
              </div>
            )}

            {salesResult && (
              <SalesResultSummary
                data={salesResult}
                onContinue={() => { setTab('statement'); resetSales() }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Passo 2: Extrato bancário ── */}
      {tab === 'statement' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Importe o extrato bancário</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                OFX exportado do seu banco ou CSV de transações. O Recix cruza automaticamente com as vendas registradas.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* OFX option */}
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-green-400" />
                  <p className="text-xs font-semibold text-green-300">OFX — Recomendado</p>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Exportado direto do app do banco. O Recix lê automaticamente — sem configurar colunas.
                </p>
              </div>
              {/* CSV option */}
              <div className="rounded-xl border border-gray-800 bg-gray-800/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-gray-400" />
                  <p className="text-xs font-semibold text-gray-300">CSV com colunas</p>
                </div>
                <ColGuide
                  filename="recix-extrato-modelo.csv"
                  template={STATEMENT_TEMPLATE}
                  cols={[
                    { name: 'eventId/id', required: true,  example: 'evt_001' },
                    { name: 'paidAmount', required: true,  example: '350.00'  },
                    { name: 'paidAt',     required: true,  example: '2026-05-01T09:35:00Z' },
                    { name: 'type',       required: false, example: 'credit'  },
                    { name: 'reference',  required: false, example: 'TX001'   },
                  ]}
                />
              </div>
            </div>

            <BankTips />

            <DropZone
              accept=".ofx,.ofc,.csv"
              file={statementFile}
              onFile={f => { setStatementFile(f); stmtMutation.reset() }}
            />

            {statementFile && !stmtMutation.data && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => stmtMutation.mutate(statementFile)}
                  disabled={stmtMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  <Upload size={15} />
                  {stmtMutation.isPending ? 'Importando...' : 'Importar e conciliar'}
                </button>
                <button onClick={resetStatement} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  Limpar
                </button>
              </div>
            )}

            {stmtMutation.error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex gap-2 text-sm text-red-400">
                <XCircle size={15} className="flex-shrink-0 mt-0.5" /> {stmtMutation.error.message}
              </div>
            )}

            {stmtResult && <StatementResultSummary data={stmtResult} />}
          </div>
        </div>
      )}

      {/* Link rápido para conciliações */}
      {(salesDone || stmtResult) && (
        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <GitMerge size={18} className="text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-200">Ver resultados da conciliação</p>
              <p className="text-xs text-gray-500">Acesse o painel para ver o que foi conciliado e as divergências detectadas.</p>
            </div>
          </div>
          <Link
            to="/reconciliations"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/15 hover:bg-green-500/25 text-green-400 text-sm font-semibold transition-colors border border-green-500/20"
          >
            Conciliações <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  )
}
