import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import {
  Upload, CheckCircle, XCircle, AlertTriangle,
  FileText, ArrowRight, ShoppingCart, Building2,
  GitMerge, Info, Download, HelpCircle, Eye, Loader2,
  RotateCcw,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import type {
  ImportStatementResult, ImportSalesResult,
  ImportPreviewResult, ImportPreviewLine,
} from '../types'
import { importService } from '../services/importService'

// ─── Templates ────────────────────────────────────────────────────────────────

const SALES_TEMPLATE = `valor,descricao,data
350.00,Amortecedor dianteiro,2026-05-01 09:30
120.00,Filtro de óleo,2026-05-01 10:15
89.90,Pastilha de freio,2026-05-01 14:00`

const STATEMENT_TEMPLATE = `eventId,paidAmount,paidAt,referenceId,provider
evt_abc123,350.00,2026-05-01T09:35:00Z,,Banco
evt_def456,120.00,2026-05-01T10:20:00Z,TX002,Banco`

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ accept, file, onFile, disabled }: {
  accept: string; file: File | null
  onFile: (f: File) => void; disabled?: boolean
}) {
  const ref  = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    const ok  = accept.split(',').some(a => a.trim().replace('.', '') === ext)
    if (!ok) { alert(`Formatos aceitos: ${accept}`); return }
    onFile(f)
  }

  return (
    <div
      onDragOver={e => { if (!disabled) { e.preventDefault(); setDrag(true) } }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) { const f = e.dataTransfer.files[0]; if (f) handleFile(f) } }}
      onClick={() => !file && !disabled && ref.current?.click()}
      className={[
        'rounded-xl border-2 border-dashed p-6 text-center transition-all',
        disabled    ? 'border-gray-800 opacity-50 cursor-not-allowed' :
        drag        ? 'border-indigo-500 bg-indigo-500/5 cursor-copy' :
        file        ? 'border-green-500/40 bg-green-500/5 cursor-default' :
                      'border-gray-700 hover:border-indigo-500/50 hover:bg-indigo-500/5 cursor-pointer',
      ].join(' ')}
    >
      <input ref={ref} type="file" accept={accept} className="hidden" disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      {file ? (
        <div className="flex items-center gap-3 justify-center">
          <FileText size={18} className="text-green-400 flex-shrink-0" />
          <div className="text-left">
            <p className="text-sm font-semibold text-green-400">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          {!disabled && (
            <button onClick={e => { e.stopPropagation(); ref.current?.click() }}
              className="ml-2 text-xs text-gray-600 hover:text-gray-400 underline whitespace-nowrap">
              Trocar
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4">
          <Upload size={24} className="text-gray-600" />
          <p className="text-sm text-gray-400">Arraste aqui ou clique para selecionar</p>
          <p className="text-xs text-gray-600">{accept.toUpperCase().replace(/\./g, '').replace(/,/g, ', ')}</p>
        </div>
      )}
    </div>
  )
}

// ─── Col guide ────────────────────────────────────────────────────────────────

function ColGuide({ cols, template, filename }: {
  cols: { name: string; required: boolean; example: string }[]
  template: string; filename: string
}) {
  function download() {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' })),
      download: filename,
    })
    a.click()
  }
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-800/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400">Colunas do arquivo</p>
        <button onClick={download} className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors">
          <Download size={11} /> Baixar modelo
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cols.map(c => (
          <div key={c.name} className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-900 border border-gray-700">
            <code className="text-[11px] text-indigo-300">{c.name}</code>
            {c.required
              ? <span className="text-[9px] text-red-400 font-bold">*</span>
              : <span className="text-[9px] text-gray-600">opt</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Preview table ────────────────────────────────────────────────────────────

function PreviewTable({ preview }: { preview: ImportPreviewResult }) {
  const isSales = preview.type === 'Sales'

  function rowStyle(status: string) {
    if (status === 'Ok')      return 'hover:bg-green-500/5'
    if (status === 'Warning') return 'bg-amber-500/5 hover:bg-amber-500/8'
    return 'bg-red-500/5 hover:bg-red-500/8'
  }

  function statusIcon(line: ImportPreviewLine) {
    if (line.status === 'Ok')      return <CheckCircle  size={13} className="text-green-400 flex-shrink-0" />
    if (line.status === 'Warning') return <AlertTriangle size={13} className="text-amber-400 flex-shrink-0" />
    return <XCircle size={13} className="text-red-400 flex-shrink-0" />
  }

  const showLines = preview.lines.slice(0, 100)

  return (
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-900 border-b border-gray-800 z-10">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 w-10">#</th>
              <th className="px-3 py-2 text-left text-gray-500 w-8"></th>
              {isSales ? (
                <>
                  <th className="px-3 py-2 text-left text-gray-500">Descrição</th>
                  <th className="px-3 py-2 text-left text-gray-500">Valor</th>
                  <th className="px-3 py-2 text-left text-gray-500">Data</th>
                </>
              ) : (
                <>
                  <th className="px-3 py-2 text-left text-gray-500">ID</th>
                  <th className="px-3 py-2 text-left text-gray-500">Valor</th>
                  <th className="px-3 py-2 text-left text-gray-500">Data</th>
                </>
              )}
              <th className="px-3 py-2 text-left text-gray-500">Aviso</th>
            </tr>
          </thead>
          <tbody>
            {showLines.map(l => (
              <tr key={l.lineNumber} className={`border-b border-gray-800/40 ${rowStyle(l.status)}`}>
                <td className="px-3 py-2 text-gray-600 font-mono">{l.lineNumber}</td>
                <td className="px-3 py-2">{statusIcon(l)}</td>
                {isSales ? (
                  <>
                    <td className="px-3 py-2 text-gray-300 max-w-[180px] truncate">{l.description ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-300 tabular-nums whitespace-nowrap">
                      {l.amount != null ? `R$ ${l.amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{l.date ?? '—'}</td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 font-mono text-gray-400 max-w-[140px] truncate">{l.eventId ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-300 tabular-nums whitespace-nowrap">
                      {l.amount != null ? `R$ ${l.amount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{l.date ?? '—'}</td>
                  </>
                )}
                <td className="px-3 py-2 text-gray-500 italic max-w-[200px] truncate" title={l.message ?? ''}>
                  {l.message ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {preview.lines.length > 100 && (
          <p className="text-center text-xs text-gray-600 py-2">
            Mostrando primeiras 100 linhas de {preview.lines.length}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Preview summary bar ──────────────────────────────────────────────────────

function PreviewSummary({ preview }: { preview: ImportPreviewResult }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl bg-gray-800/60 border border-gray-700">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle size={14} className="text-green-400" />
        <span className="text-green-400 font-semibold">{preview.validLines}</span>
        <span className="text-gray-500">válidas</span>
      </div>
      {preview.warningLines > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="text-amber-400 font-semibold">{preview.warningLines}</span>
          <span className="text-gray-500">avisos</span>
        </div>
      )}
      {preview.errorLines > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <XCircle size={14} className="text-red-400" />
          <span className="text-red-400 font-semibold">{preview.errorLines}</span>
          <span className="text-gray-500">erros</span>
        </div>
      )}
      {preview.detectedColumns.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-500 ml-auto">
          <Info size={12} />
          Colunas detectadas: <span className="text-gray-400">{preview.detectedColumns.join(', ')}</span>
        </div>
      )}
    </div>
  )
}

// ─── Import result ────────────────────────────────────────────────────────────

function ImportResult({
  isSales, salesResult, stmtResult, onReset, onContinue,
}: {
  isSales: boolean
  salesResult?: ImportSalesResult
  stmtResult?:  ImportStatementResult
  onReset:   () => void
  onContinue?: () => void
}) {
  const imported = isSales ? salesResult?.created ?? 0 : stmtResult?.imported ?? 0
  const dupes    = isSales ? salesResult?.skipped  ?? 0 : stmtResult?.duplicates ?? 0
  const errors   = isSales ? salesResult?.errors   ?? 0 : stmtResult?.errors     ?? 0
  const hasOk    = imported > 0

  return (
    <div className="space-y-4">
      {/* Contagem */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center">
          <p className="text-2xl font-black text-green-400">{imported}</p>
          <p className="text-xs text-gray-500 mt-0.5">{isSales ? 'Vendas criadas' : 'Importadas'}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <p className="text-2xl font-black text-amber-400">{dupes}</p>
          <p className="text-xs text-gray-500 mt-0.5">{isSales ? 'Ignoradas' : 'Duplicadas'}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
          <p className="text-2xl font-black text-red-400">{errors}</p>
          <p className="text-xs text-gray-500 mt-0.5">Erros</p>
        </div>
      </div>

      {/* Mensagem de sucesso */}
      {hasOk && (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 flex items-start gap-3">
          <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            {isSales ? (
              <>
                <p className="text-sm font-semibold text-green-300">
                  {imported} venda{imported !== 1 ? 's' : ''} registrada{imported !== 1 ? 's' : ''} com sucesso
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Agora importe o extrato bancário para o Recix cruzar automaticamente.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-green-300">
                  {imported} transação{imported !== 1 ? 'ões' : ''} importada{imported !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Conciliação em andamento em tempo real. Verifique os resultados na aba de Conciliações.
                </p>
              </>
            )}
          </div>
          {isSales && onContinue ? (
            <button onClick={onContinue}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors whitespace-nowrap">
              Ir para extrato <ArrowRight size={12} />
            </button>
          ) : (
            <Link to="/reconciliations"
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-semibold transition-colors whitespace-nowrap">
              Ver conciliações <ArrowRight size={12} />
            </Link>
          )}
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3">
        <button onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
          <RotateCcw size={12} /> Importar outro arquivo
        </button>
        {!isSales && (
          <Link to="/reconciliations?tab=review"
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors ml-auto">
            <Eye size={12} /> Ver pendentes de revisão
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Bank tips ────────────────────────────────────────────────────────────────

const BANKS = [
  { name: 'Itaú',      hint: 'App → Minha Conta → Extrato → Exportar OFX',        color: '#f97316' },
  { name: 'Bradesco',  hint: 'Internet Banking → Extrato → Exportar OFX',          color: '#ef4444' },
  { name: 'Nubank',    hint: 'App → Perfil → Exportar extrato (OFX)',              color: '#7c3aed' },
  { name: 'Santander', hint: 'Internet Banking → Extrato → Exportar OFX',          color: '#dc2626' },
  { name: 'BB',        hint: 'App/Internet Banking → Extrato → Exportar OFX/CSV',  color: '#eab308' },
  { name: 'Outros',    hint: 'Acesse seu internet banking e exporte o extrato OFX', color: '#6b7280' },
]

function BankTips() {
  const [active, setActive] = useState<string | null>(null)
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
        <HelpCircle size={12} /> Como exportar do seu banco
      </p>
      <div className="flex flex-wrap gap-2">
        {BANKS.map(b => (
          <button key={b.name} onClick={() => setActive(active === b.name ? null : b.name)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${active === b.name ? 'border-gray-600 bg-gray-800 text-gray-200' : 'border-gray-800 bg-gray-900/60 text-gray-400 hover:border-gray-700'}`}>
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

// ─── Import Panel ─────────────────────────────────────────────────────────────

type PanelStep = 'upload' | 'preview' | 'result'

function ImportPanel({
  type,
  accept,
  title,
  description,
  colGuide,
  extraContent,
  onDone,
}: {
  type: 'sales' | 'statement'
  accept: string
  title: string
  description: string
  colGuide: React.ReactNode
  extraContent?: React.ReactNode
  onDone?: () => void
}) {
  const [step, setStep]     = useState<PanelStep>('upload')
  const [file, setFile]     = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)

  const previewMut = useMutation<ImportPreviewResult, Error, File>({
    mutationFn: type === 'sales' ? importService.previewSales : importService.previewStatement,
    onSuccess: res => { setPreview(res); setStep('preview') },
  })

  const importMut = useMutation<ImportSalesResult | ImportStatementResult, Error, File>({
    mutationFn: type === 'sales' ? importService.uploadSales : importService.uploadStatement,
    onSuccess: () => setStep('result'),
  })

  function handleFileSelect(f: File) {
    setFile(f)
    setPreview(null)
    previewMut.reset()
    importMut.reset()
    setStep('upload')
  }

  function handlePreview() {
    if (file) previewMut.mutate(file)
  }

  function handleConfirm() {
    if (file) importMut.mutate(file)
  }

  function handleReset() {
    setFile(null)
    setPreview(null)
    previewMut.reset()
    importMut.reset()
    setStep('upload')
  }

  const canConfirm = preview && !preview.hasBlockingErrors && preview.validLines > 0
  const isSales    = type === 'sales'

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      {colGuide}
      {extraContent}

      {/* Upload area — sempre visível até ter resultado */}
      {step !== 'result' && (
        <DropZone
          accept={accept}
          file={file}
          onFile={handleFileSelect}
          disabled={step === 'preview' && importMut.isPending}
        />
      )}

      {/* Erros da API */}
      {(previewMut.error || importMut.error) && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex gap-2 text-sm text-red-400">
          <XCircle size={15} className="flex-shrink-0 mt-0.5" />
          {(previewMut.error ?? importMut.error)?.message}
        </div>
      )}

      {/* Botão de preview */}
      {step === 'upload' && file && !previewMut.isPending && (
        <div className="flex items-center gap-3">
          <button onClick={handlePreview}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            <Eye size={15} /> Validar e pré-visualizar
          </button>
          <button onClick={handleReset} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Limpar
          </button>
        </div>
      )}

      {/* Loading preview */}
      {previewMut.isPending && (
        <div className="flex items-center gap-2 text-sm text-indigo-400">
          <Loader2 size={15} className="animate-spin" /> Validando arquivo...
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && preview && (
        <>
          <PreviewSummary preview={preview} />
          <PreviewTable preview={preview} />

          {preview.hasBlockingErrors && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2 text-sm text-red-400">
              <XCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>
                Todas as linhas têm erros. Corrija o arquivo e faça o upload novamente.
              </span>
            </div>
          )}

          {preview.warningLines > 0 && !preview.hasBlockingErrors && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span>
                {preview.warningLines} linha{preview.warningLines !== 1 ? 's' : ''} com avisos serão ignoradas.
                As {preview.validLines} válidas serão importadas normalmente.
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || importMut.isPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {importMut.isPending
                ? <><Loader2 size={15} className="animate-spin" /> Importando...</>
                : <><Upload size={15} /> Confirmar e importar {preview.validLines} {isSales ? 'venda' : 'transação'}{preview.validLines !== 1 ? 's' : ''}</>}
            </button>
            <button onClick={handleReset} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              Cancelar
            </button>
          </div>
        </>
      )}

      {/* Resultado */}
      {step === 'result' && (
        <ImportResult
          isSales={isSales}
          salesResult={isSales ? importMut.data as ImportSalesResult : undefined}
          stmtResult={!isSales ? importMut.data as ImportStatementResult : undefined}
          onReset={handleReset}
          onContinue={onDone}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'sales' | 'statement'

export function ImportPage() {
  const [tab, setTab]     = useState<Tab>('sales')
  const [salesDone, setSalesDone] = useState(false)

  return (
    <div>
      <Header
        title="Importar Dados"
        subtitle="Valide e confirme antes de importar — zero surpresas"
      />

      {/* Como funciona */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Info size={14} className="text-indigo-400" />
          <h2 className="text-sm font-semibold text-gray-200">Fluxo de importação</h2>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-400">
          {[
            { icon: <Upload size={14} />,       label: '1. Selecione o arquivo' },
            { icon: <Eye size={14} />,           label: '2. Revise o preview' },
            { icon: <CheckCircle size={14} />,   label: '3. Confirme a importação' },
            { icon: <GitMerge size={14} />,      label: '4. Veja a conciliação' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-indigo-400">{s.icon}</span>
                <span>{s.label}</span>
              </div>
              {i < 3 && <ArrowRight size={12} className="text-gray-700 flex-shrink-0" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
          <Info size={11} />
          Importe vendas e extrato em qualquer ordem. O Recix re-concilia automaticamente.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl mb-6 w-fit">
        {([
          { id: 'sales',     label: 'Vendas',          icon: <ShoppingCart size={13} />, done: salesDone },
          { id: 'statement', label: 'Extrato bancário', icon: <Building2   size={13} />, done: false },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200',
            ].join(' ')}>
            {t.done ? <CheckCircle size={13} className="text-green-400" /> : t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Painel de vendas */}
      {tab === 'sales' && (
        <ImportPanel
          type="sales"
          accept=".csv"
          title="Importe suas vendas"
          description="CSV com as vendas do período. Cada linha vira uma cobrança que o sistema espera receber."
          colGuide={
            <ColGuide
              filename="recix-vendas-modelo.csv"
              template={SALES_TEMPLATE}
              cols={[
                { name: 'valor',     required: true,  example: '350.00' },
                { name: 'descricao', required: true,  example: 'Amortecedor' },
                { name: 'data',      required: false, example: '2026-05-01 09:30' },
              ]}
            />
          }
          onDone={() => { setSalesDone(true); setTab('statement') }}
        />
      )}

      {/* Painel de extrato */}
      {tab === 'statement' && (
        <ImportPanel
          type="statement"
          accept=".ofx,.ofc,.csv"
          title="Importe o extrato bancário"
          description="OFX do seu banco ou CSV de transações. O Recix cruza com as vendas e detecta divergências automaticamente."
          colGuide={
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <CheckCircle size={12} className="text-green-400" />
                  <p className="text-xs font-semibold text-green-300">OFX — Recomendado</p>
                </div>
                <p className="text-xs text-gray-400">Exportado direto do banco. Colunas detectadas automaticamente.</p>
              </div>
              <ColGuide
                filename="recix-extrato-modelo.csv"
                template={STATEMENT_TEMPLATE}
                cols={[
                  { name: 'eventId',    required: true,  example: 'evt_001' },
                  { name: 'paidAmount', required: true,  example: '350.00' },
                  { name: 'paidAt',     required: true,  example: '2026-05-01T09:35:00Z' },
                  { name: 'reference',  required: false, example: 'TX001' },
                ]}
              />
            </div>
          }
          extraContent={<BankTips />}
        />
      )}

      {/* Link para conciliações */}
      {salesDone && (
        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GitMerge size={16} className="text-green-400" />
            <p className="text-sm text-gray-300">Acesse as conciliações para acompanhar os resultados em tempo real.</p>
          </div>
          <Link to="/reconciliations"
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/15 hover:bg-green-500/25 text-green-400 text-sm font-semibold transition-colors border border-green-500/20 whitespace-nowrap">
            Ver conciliações <ArrowRight size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}
