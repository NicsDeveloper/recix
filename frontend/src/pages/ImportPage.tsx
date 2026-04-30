import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  FileText,
  Download,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import type { ImportStatementResult } from '../types'
import { importService } from '../services/importService'


const EXAMPLE_CSV = `eventId,paidAmount,paidAt,referenceId,externalChargeId,provider
evt_abc123,150.75,2026-04-29T10:00:00Z,RECIX-20260429-000001,,EfiBank
evt_def456,3200.00,2026-04-29T11:30:00Z,,psp_ext_9988,EfiBank
evt_ghi789,899.90,2026-04-29T14:00:00Z,RECIX-20260429-000002,,Itaú`

function downloadTemplate() {
  const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'recix-extrato-modelo.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { mutate, isPending, data: result, error, reset } = useMutation<ImportStatementResult, Error, File>({
    mutationFn: (file) => importService.uploadStatement(file),
  })

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      alert('Apenas arquivos .csv são suportados.')
      return
    }
    setSelectedFile(file)
    reset()
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const statusIcon = {
    Imported:  <CheckCircle size={14} className="text-green-400 flex-shrink-0" />,
    Duplicate: <Copy size={14} className="text-amber-400 flex-shrink-0" />,
    Error:     <XCircle size={14} className="text-red-400 flex-shrink-0" />,
  } as const

  const statusColor = {
    Imported:  'text-green-400',
    Duplicate: 'text-amber-400',
    Error:     'text-red-400',
  } as const

  return (
    <div>
      <Header
        title="Importar Extrato"
        subtitle="Carregue um CSV do seu banco e o RECIX reconcilia automaticamente cada linha"
      />

      {/* Template download */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-200 mb-1">Formato esperado</h2>
            <p className="text-xs text-gray-500 mb-2">
              O arquivo deve ter as colunas abaixo. Ao menos um de{' '}
              <code className="text-indigo-400">referenceId</code> ou{' '}
              <code className="text-indigo-400">externalChargeId</code> deve estar preenchido.
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs text-gray-400 border-collapse">
                <thead>
                  <tr className="text-gray-500">
                    {['eventId*', 'paidAmount*', 'paidAt*', 'referenceId', 'externalChargeId', 'provider'].map(h => (
                      <th key={h} className="border border-gray-800 px-3 py-1.5 text-left font-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-800 px-3 py-1.5 font-mono text-gray-500">evt_abc123</td>
                    <td className="border border-gray-800 px-3 py-1.5 font-mono text-gray-500">150.75</td>
                    <td className="border border-gray-800 px-3 py-1.5 font-mono text-gray-500">2026-04-29T10:00:00Z</td>
                    <td className="border border-gray-800 px-3 py-1.5 font-mono text-gray-500">RECIX-20260429-000001</td>
                    <td className="border border-gray-800 px-3 py-1.5 font-mono text-gray-500"></td>
                    <td className="border border-gray-800 px-3 py-1.5 font-mono text-gray-500">EfiBank</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-xs text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 transition-colors"
          >
            <Download size={13} />
            Baixar modelo
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          'rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all mb-5',
          dragOver
            ? 'border-indigo-500 bg-indigo-500/5'
            : selectedFile
              ? 'border-green-500/40 bg-green-500/5'
              : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/30',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        {selectedFile ? (
          <div className="flex flex-col items-center gap-2">
            <FileText size={28} className="text-green-400" />
            <p className="text-sm font-medium text-green-400">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">{(selectedFile.size / 1024).toFixed(1)} KB · Clique para trocar</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={28} className="text-gray-600" />
            <p className="text-sm text-gray-400">Arraste o arquivo CSV aqui ou clique para selecionar</p>
            <p className="text-xs text-gray-600">Apenas .csv</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => selectedFile && mutate(selectedFile)}
          disabled={!selectedFile || isPending}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Upload size={15} />
          {isPending ? 'Importando...' : 'Importar e reconciliar'}
        </button>
        {selectedFile && !isPending && (
          <button
            onClick={() => { setSelectedFile(null); reset() }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Limpar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          {error.message}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{result.imported}</p>
              <p className="text-xs text-gray-500 mt-1">Importados</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{result.duplicates}</p>
              <p className="text-xs text-gray-500 mt-1">Duplicados ignorados</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{result.errors}</p>
              <p className="text-xs text-gray-500 mt-1">Erros</p>
            </div>
          </div>

          {/* Line-by-line table */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-gray-200">
                Detalhes por linha
                <span className="ml-2 text-xs font-normal text-gray-500">({result.lines.length} linhas processadas)</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-500">
                    <th className="px-4 py-2.5 text-left w-16">Linha</th>
                    <th className="px-4 py-2.5 text-left">EventId</th>
                    <th className="px-4 py-2.5 text-left w-28">Status</th>
                    <th className="px-4 py-2.5 text-left">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((line) => (
                    <tr key={`${line.line}-${line.eventId}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 text-gray-600 font-mono">{line.line}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-400 truncate max-w-[200px]" title={line.eventId}>
                        {line.eventId || '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {statusIcon[line.status as keyof typeof statusIcon] ?? <AlertTriangle size={14} className="text-gray-500" />}
                          <span className={statusColor[line.status as keyof typeof statusColor] ?? 'text-gray-400'}>
                            {line.status === 'Imported' ? 'Importado' : line.status === 'Duplicate' ? 'Duplicado' : 'Erro'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 italic">{line.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
