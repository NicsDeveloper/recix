import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronDown, Plus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export type DashboardDatePreset = 'today' | '7d' | '30d'

interface DashboardHeaderProps {
  title: string
  subtitle: string
  fromDate: string
  toDate: string
  updatedAt: string | null | undefined
  onFromDateChange: (v: string) => void
  onToDateChange:   (v: string) => void
  /** Atalhos de intervalo (alinhados ao filtro da página Cobranças). */
  onDatePreset?: (preset: DashboardDatePreset) => void
}

function timeAgo(updatedAt: string | null | undefined) {
  if (!updatedAt) return null
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return null
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (diffSec < 60) return `Atualizado há ${diffSec} s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `Atualizado há ${diffMin} min`
  return `Atualizado há ${Math.floor(diffMin / 60)}h`
}

function fmtDateBr(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function DashboardHeader({
  title, subtitle, fromDate, toDate, updatedAt,
  onFromDateChange, onToDateChange, onDatePreset,
}: DashboardHeaderProps) {
  const { currentOrg } = useAuth()
  const isAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'
  const ago = timeAgo(updatedAt)
  const [rangeOpen, setRangeOpen] = useState(false)
  const rangeWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!rangeOpen) return
    function onDocMouseDown(e: MouseEvent) {
      const el = rangeWrapRef.current
      if (el && !el.contains(e.target as Node)) setRangeOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [rangeOpen])

  return (
    <div className="flex items-start justify-between gap-6 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-50 leading-tight">{title}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Intervalo de datas: um botão abre painel com inputs nativos (comportamento confiável em todos os browsers) */}
        <div ref={rangeWrapRef} className="relative">
          <button
            type="button"
            onClick={() => setRangeOpen(v => !v)}
            aria-expanded={rangeOpen}
            aria-haspopup="dialog"
            className="flex items-center gap-2.5 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 hover:border-gray-600 transition-colors text-left min-w-[260px]"
          >
            <Calendar size={16} className="text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-100 tabular-nums whitespace-nowrap">
                {fmtDateBr(fromDate)}
                <span className="text-gray-500 font-normal px-1.5" aria-hidden>
                  —
                </span>
                {fmtDateBr(toDate)}
              </p>
              <p className="text-[10px] text-gray-600 leading-none mt-0.5">
                Intervalo · por data de criação da cobrança
              </p>
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-500 flex-shrink-0 transition-transform ${rangeOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {rangeOpen && (
            <div
              role="dialog"
              aria-label="Escolher período"
              className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(100vw-2rem,280px)] rounded-xl border border-gray-700 bg-gray-900 p-4 shadow-2xl shadow-black/40"
            >
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-medium text-gray-400">Data inicial</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={e => onFromDateChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 [color-scheme:dark]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-400">Data final</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={e => onToDateChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 [color-scheme:dark]"
                  />
                </label>
                {onDatePreset && (
                  <div className="pt-2 border-t border-gray-800">
                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-2">Atalhos</p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['today', 'Hoje'] as const,
                          ['7d', '7 dias'] as const,
                          ['30d', '30 dias'] as const,
                        ] as const
                      ).map(([preset, label]) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            onDatePreset(preset)
                            setRangeOpen(false)
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-600 bg-gray-800/80 text-gray-300 hover:bg-gray-700 hover:border-gray-500"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setRangeOpen(false)}
                className="mt-4 w-full rounded-lg bg-gray-800 py-2 text-xs font-semibold text-gray-200 hover:bg-gray-700 border border-gray-600"
              >
                Concluir
              </button>
            </div>
          )}
        </div>

        {/* Last updated */}
        {ago && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {ago}
          </div>
        )}

        {/* Simulate event */}
        {isAdmin && (
          <Link
            to="/webhooks/simulator"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors whitespace-nowrap shadow-lg shadow-indigo-500/20"
          >
            <Plus size={16} strokeWidth={2.5} />
            Simular Evento
          </Link>
        )}
      </div>
    </div>
  )
}
