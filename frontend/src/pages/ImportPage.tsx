import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  FileText,
  Shield,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  Lightbulb,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import type { ImportStatementResult, ImportSalesResult } from '../types'
import { importService } from '../services/importService'

// ─── Local history (localStorage) ────────────────────────────────────────────

interface ImportRecord {
  id: string
  filename: string
  period: string
  bank: string
  bankColor: string
  registros: number
  status: 'Concluído' | 'Erro'
  date: string
}

const HISTORY_KEY = 'recix_import_history'

function loadHistory(): ImportRecord[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') } catch { return [] }
}

function saveHistory(records: ImportRecord[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 10)))
}

function detectBank(filename: string): { bank: string; color: string } {
  const f = filename.toLowerCase()
  if (f.includes('itau') || f.includes('itaú'))      return { bank: 'Itaú',       color: '#f97316' }
  if (f.includes('bradesco'))                         return { bank: 'Bradesco',   color: '#ef4444' }
  if (f.includes('nubank'))                           return { bank: 'Nubank',     color: '#7c3aed' }
  if (f.includes('santander'))                        return { bank: 'Santander',  color: '#dc2626' }
  if (f.includes('inter'))                            return { bank: 'Inter',      color: '#f97316' }
  if (f.includes('caixa'))                            return { bank: 'Caixa',      color: '#2563eb' }
  if (f.includes('bb') || f.includes('bancodobrasil')) return { bank: 'BB',        color: '#eab308' }
  if (f.includes('sicoob'))                           return { bank: 'Sicoob',     color: '#16a34a' }
  return { bank: 'Banco', color: '#6b7280' }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Selecionar arquivo',    sub: 'Escolha o arquivo do extrato' },
  { label: 'Validar dados',         sub: 'Verificamos o formato do arquivo' },
  { label: 'Configurar importação', sub: 'Mapeie as colunas (se necessário)' },
  { label: 'Importar e conciliar',  sub: 'Inicie a conciliação automática' },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-start gap-0 mb-6">
      {STEPS.map((step, i) => {
        const n       = i + 1
        const done    = n < current
        const active  = n === current
        const last    = i === STEPS.length - 1

        return (
          <div key={n} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                done   ? 'bg-indigo-600 text-white'         :
                active ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20' :
                         'bg-gray-800 text-gray-500 border border-gray-700',
              ].join(' ')}>
                {done ? <CheckCircle size={16} /> : n}
              </div>
              <div className="mt-2 text-center px-1">
                <p className={`text-xs font-semibold leading-tight ${active ? 'text-indigo-400' : done ? 'text-gray-300' : 'text-gray-600'}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-gray-600 leading-tight mt-0.5 hidden sm:block">{step.sub}</p>
              </div>
            </div>
            {!last && (
              <div className={`flex-1 h-px mt-4 mx-1 ${n < current ? 'bg-indigo-600' : 'bg-gray-800'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Bank buttons ─────────────────────────────────────────────────────────────

const BANKS = [
  { name: 'Itaú',          color: '#f97316', hint: 'App Itaú → Minha Conta → Extrato → Exportar OFX' },
  { name: 'Bradesco',      color: '#ef4444', hint: 'Internet Banking → Extrato → Download OFX' },
  { name: 'Nubank',        color: '#7c3aed', hint: 'App Nubank → Perfil → Exportar extrato (OFX)' },
  { name: 'Santander',     color: '#dc2626', hint: 'Internet Banking → Extrato → Exportar OFX' },
  { name: 'Outros bancos', color: '#6b7280', hint: 'Acesse seu internet banking e exporte o extrato no formato OFX ou CSV' },
]

function BankButton({ bank }: { bank: typeof BANKS[number] }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setShow(v => !v)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800/60 hover:bg-gray-800 hover:border-gray-600 transition-all text-xs text-gray-300 font-medium"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: bank.color }}
        />
        {bank.name}
      </button>
      {show && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-gray-800 border border-gray-700 p-3 text-xs text-gray-300 shadow-2xl z-50">
          <p className="font-semibold text-gray-100 mb-1">Como exportar</p>
          <p className="text-gray-400 leading-relaxed">{bank.hint}</p>
          <div className="absolute bottom-[-5px] left-4 w-2.5 h-2.5 bg-gray-800 border-r border-b border-gray-700 rotate-45" />
        </div>
      )}
    </div>
  )
}

// ─── Info panel ───────────────────────────────────────────────────────────────

function InfoPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Informações importantes
        </h3>
        <div className="space-y-4">
          {[
            {
              Icon: Shield,
              title: 'Seus dados estão seguros',
              body: 'Seus arquivos são processados com segurança e não são armazenados após a conciliação.',
              color: 'text-blue-400',
              bg: 'bg-blue-500/10',
            },
            {
              Icon: FileText,
              title: 'Formatos suportados',
              body: 'OFX (recomendado) ou CSV exportado do internet banking. Arquivos de até 10 MB.',
              color: 'text-indigo-400',
              bg: 'bg-indigo-500/10',
            },
            {
              Icon: CheckCircle,
              title: 'O que é conciliado?',
              body: 'Compararemos os recebimentos do extrato com suas vendas para identificar divergências.',
              color: 'text-green-400',
              bg: 'bg-green-500/10',
            },
          ].map(({ Icon, title, body, color, bg }) => (
            <div key={title} className="flex gap-3">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={15} className={color} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-200">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Lightbulb size={13} className="text-amber-400" />
          Dicas para melhor resultado
        </h3>
        <ul className="space-y-2">
          {[
            'Exportar o período completo que deseja conciliar',
            'Usar o formato OFX quando disponível',
            'Verificar se todas as movimentações estão incluídas',
          ].map(tip => (
            <li key={tip} className="flex items-start gap-2 text-xs text-gray-400">
              <CheckCircle size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <button className="w-full rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-center gap-3 hover:bg-gray-800/60 hover:border-gray-700 transition-all group">
        <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
          <HelpCircle size={15} className="text-gray-400" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-gray-200">Precisa de ajuda?</p>
          <p className="text-xs text-gray-500">Fale com nosso suporte</p>
        </div>
        <ChevronRight size={15} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
      </button>
    </div>
  )
}

// ─── Result table ─────────────────────────────────────────────────────────────

function ResultTable({ data }: { data: ImportStatementResult }) {
  const statusIcon = {
    Imported:  <CheckCircle size={13} className="text-green-400 flex-shrink-0" />,
    Duplicate: <Copy        size={13} className="text-amber-400 flex-shrink-0" />,
    Error:     <XCircle     size={13} className="text-red-400   flex-shrink-0" />,
  } as const
  const statusLabel = { Imported: 'Importado', Duplicate: 'Duplicado', Error: 'Erro' } as const

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden mt-5">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">
          Detalhes por transação
        </h2>
        <span className="text-xs text-gray-500">{data.lines.length} transações</span>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="px-4 py-2.5 text-left w-12">#</th>
              <th className="px-4 py-2.5 text-left">EventId / FITID</th>
              <th className="px-4 py-2.5 text-left w-28">Status</th>
              <th className="px-4 py-2.5 text-left">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={`${line.line}-${line.eventId}`} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                <td className="px-4 py-2 text-gray-600 font-mono">{line.line}</td>
                <td className="px-4 py-2 font-mono text-gray-400 truncate max-w-[200px]" title={line.eventId}>
                  {line.eventId || '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    {statusIcon[line.status as keyof typeof statusIcon] ?? <AlertTriangle size={13} className="text-gray-500" />}
                    <span className={{
                      Imported: 'text-green-400',
                      Duplicate: 'text-amber-400',
                      Error: 'text-red-400',
                    }[line.status] ?? 'text-gray-400'}>
                      {statusLabel[line.status as keyof typeof statusLabel] ?? line.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-600 italic">{line.error ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Sales result table ───────────────────────────────────────────────────────

function SalesResultTable({ data }: { data: ImportSalesResult }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden mt-5">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Cobranças criadas</h2>
        <span className="text-xs text-gray-500">{data.lines.length} vendas processadas</span>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="px-4 py-2.5 text-left w-12">#</th>
              <th className="px-4 py-2.5 text-left">Descrição</th>
              <th className="px-4 py-2.5 text-right w-28">Valor</th>
              <th className="px-4 py-2.5 text-left w-28">Status</th>
              <th className="px-4 py-2.5 text-left">ReferenceId / Erro</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.line} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                <td className="px-4 py-2 text-gray-600 font-mono">{line.line}</td>
                <td className="px-4 py-2 text-gray-300 truncate max-w-[180px]">{line.description || '—'}</td>
                <td className="px-4 py-2 text-right font-mono text-gray-300">
                  {line.amount > 0 ? `R$ ${line.amount.toFixed(2).replace('.', ',')}` : '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    {line.status === 'Created'
                      ? <CheckCircle size={13} className="text-green-400" />
                      : line.status === 'Error'
                        ? <XCircle size={13} className="text-red-400" />
                        : <Copy size={13} className="text-amber-400" />}
                    <span className={{ Created: 'text-green-400', Error: 'text-red-400', Skipped: 'text-amber-400' }[line.status] ?? 'text-gray-400'}>
                      {line.status === 'Created' ? 'Criada' : line.status === 'Skipped' ? 'Ignorada' : 'Erro'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 font-mono text-gray-500">{line.error ?? line.referenceId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Recent imports ───────────────────────────────────────────────────────────

function RecentImports({ history }: { history: ImportRecord[] }) {
  if (history.length === 0) return null
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">Importações recentes</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="px-5 py-2.5 text-left">Arquivo</th>
              <th className="px-4 py-2.5 text-left">Período</th>
              <th className="px-4 py-2.5 text-left">Banco</th>
              <th className="px-4 py-2.5 text-left">Registros</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-left">Data</th>
            </tr>
          </thead>
          <tbody>
            {history.map(rec => (
              <tr key={rec.id} className="border-b border-gray-800/40 hover:bg-gray-800/30">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-gray-500 flex-shrink-0" />
                    <span className="font-mono text-gray-300 truncate max-w-[180px]" title={rec.filename}>
                      {rec.filename}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">{rec.period || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: rec.bankColor }} />
                    <span className="text-gray-300">{rec.bank}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-gray-300">
                  {rec.registros.toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3">
                  {rec.status === 'Concluído'
                    ? <span className="flex items-center gap-1.5 text-green-400"><CheckCircle size={13} /> Concluído</span>
                    : <span className="flex items-center gap-1.5 text-red-400"><XCircle size={13} /> Erro</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(rec.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 border-t border-gray-800">
        <button className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          Ver todas as importações <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Mode = 'statement' | 'sales'

export function ImportPage() {
  const fileRef  = useRef<HTMLInputElement>(null)
  const salesRef = useRef<HTMLInputElement>(null)

  const [mode, setMode]         = useState<Mode>('statement')
  const [step, setStep]         = useState(1)
  const [file, setFile]         = useState<File | null>(null)
  const [drag, setDrag]         = useState(false)
  const [history, setHistory]   = useState<ImportRecord[]>(loadHistory)

  const statementMutation = useMutation<ImportStatementResult, Error, File>({
    mutationFn: importService.uploadStatement,
    onSuccess: (data, f) => {
      setStep(4)
      const { bank, color } = detectBank(f.name)
      const rec: ImportRecord = {
        id:         crypto.randomUUID(),
        filename:   f.name,
        period:     '',
        bank,
        bankColor:  color,
        registros:  data.imported + data.duplicates,
        status:     data.errors > 0 && data.imported === 0 ? 'Erro' : 'Concluído',
        date:       new Date().toISOString(),
      }
      const next = [rec, ...history]
      setHistory(next)
      saveHistory(next)
    },
  })

  const salesMutation = useMutation<ImportSalesResult, Error, File>({
    mutationFn: importService.uploadSales,
    onSuccess: () => setStep(4),
  })

  const selectFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (mode === 'statement' && !['csv', 'ofx', 'ofc'].includes(ext)) {
      alert('Formatos aceitos: .ofx, .csv')
      return
    }
    if (mode === 'sales' && ext !== 'csv') {
      alert('Formato aceito: .csv')
      return
    }
    setFile(f)
    statementMutation.reset()
    salesMutation.reset()
    setStep(f ? 3 : 1)
  }, [mode, statementMutation, salesMutation])

  function switchMode(m: Mode) {
    setMode(m)
    setFile(null)
    setStep(1)
    statementMutation.reset()
    salesMutation.reset()
  }

  function runImport() {
    if (!file) return
    setStep(4)
    if (mode === 'statement') statementMutation.mutate(file)
    else salesMutation.mutate(file)
  }

  const isPending = statementMutation.isPending || salesMutation.isPending
  const stmtData  = statementMutation.data
  const salesData = salesMutation.data
  const err       = statementMutation.error ?? salesMutation.error

  useEffect(() => { if (!file) setStep(1) }, [file])

  return (
    <div>
      <Header
        title="Importar Extrato"
        subtitle="Importe seu extrato bancário para conciliar automaticamente com suas vendas"
      />

      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => switchMode('statement')}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'statement'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          Extrato Bancário
        </button>
        <button
          onClick={() => switchMode('sales')}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
            mode === 'sales'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          Importar Vendas
        </button>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-6">
        {/* ── Left column ── */}
        <div className="space-y-5">
          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault(); setDrag(false)
              const f = e.dataTransfer.files[0]
              if (f) selectFile(f)
            }}
            onClick={() => !file && (mode === 'statement' ? fileRef : salesRef).current?.click()}
            className={[
              'rounded-xl border-2 border-dashed p-10 text-center transition-all',
              !file ? 'cursor-pointer' : '',
              drag
                ? 'border-indigo-500 bg-indigo-500/5'
                : file
                  ? 'border-green-500/40 bg-green-500/5 cursor-default'
                  : 'border-indigo-500/40 bg-indigo-500/5 hover:border-indigo-500/70 hover:bg-indigo-500/8',
            ].join(' ')}
          >
            <input ref={fileRef}  type="file" accept=".ofx,.ofc,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f) }} />
            <input ref={salesRef} type="file" accept=".csv"           className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f) }} />

            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <FileText size={24} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-400">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB · pronto para importar</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setStep(1) }}
                  className="text-xs text-gray-600 hover:text-gray-400 underline"
                >
                  Trocar arquivo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Upload size={24} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">Selecione ou arraste seu arquivo</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {mode === 'statement' ? 'Formatos aceitos: OFX, CSV' : 'Formato aceito: CSV'} · Tamanho máximo: 10 MB
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); (mode === 'statement' ? fileRef : salesRef).current?.click() }}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <Upload size={15} />
                  Selecionar arquivo
                </button>
                <p className="text-xs text-gray-600">ou arraste e solte aqui</p>
              </div>
            )}
          </div>

          {/* Import button */}
          {file && !stmtData && !salesData && (
            <button
              onClick={runImport}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Upload size={16} />
              {isPending ? 'Importando e conciliando...' : 'Importar e conciliar'}
            </button>
          )}

          {/* Error */}
          {err && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 flex items-start gap-3">
              <XCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{err.message}</p>
            </div>
          )}

          {/* Summary cards */}
          {(stmtData || salesData) && (
            <div className={`grid gap-4 ${stmtData ? 'grid-cols-3' : 'grid-cols-3'}`}>
              {stmtData && <>
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{stmtData.imported}</p>
                  <p className="text-xs text-gray-500 mt-1">Importados</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">{stmtData.duplicates}</p>
                  <p className="text-xs text-gray-500 mt-1">Duplicados</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{stmtData.errors}</p>
                  <p className="text-xs text-gray-500 mt-1">Erros</p>
                </div>
              </>}
              {salesData && <>
                <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
                  <p className="text-2xl font-bold text-green-400">{salesData.created}</p>
                  <p className="text-xs text-gray-500 mt-1">Cobranças criadas</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">{salesData.skipped}</p>
                  <p className="text-xs text-gray-500 mt-1">Ignoradas</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
                  <p className="text-2xl font-bold text-red-400">{salesData.errors}</p>
                  <p className="text-xs text-gray-500 mt-1">Erros</p>
                </div>
              </>}
            </div>
          )}

          {stmtData  && <ResultTable  data={stmtData}  />}
          {salesData && <SalesResultTable data={salesData} />}

          {salesData && salesData.created > 0 && (
            <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-4 flex items-start gap-3">
              <CheckCircle size={16} className="text-indigo-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-indigo-300">
                Cobranças criadas. Agora mude para <strong>Extrato Bancário</strong> e importe o arquivo do seu banco para cruzar os pagamentos.
              </p>
            </div>
          )}

          {/* Bank links — only on statement mode */}
          {mode === 'statement' && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle size={14} className="text-gray-400" />
                <h3 className="text-xs font-semibold text-gray-300">Onde encontrar seu extrato?</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">Veja como exportar seu extrato nos principais bancos</p>
              <div className="flex flex-wrap gap-2">
                {BANKS.map(b => <BankButton key={b.name} bank={b} />)}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <InfoPanel />
      </div>

      {/* Recent imports */}
      <RecentImports history={history} />
    </div>
  )
}
