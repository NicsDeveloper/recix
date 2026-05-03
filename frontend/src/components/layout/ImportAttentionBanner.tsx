import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, X } from 'lucide-react'

const STORAGE_KEY = 'recix_import_stmt_followup'

/** Banner global após importar extrato — não deixa o utilizador ignorar o passo de auditoria. */
export function ImportAttentionBanner() {
  const [visible, setVisible] = useState(false)

  function readFlag() {
    setVisible(sessionStorage.getItem(STORAGE_KEY) === '1')
  }

  useEffect(() => {
    readFlag()
    function onEvt() { readFlag() }
    window.addEventListener('recix-import-stmt', onEvt)
    return () => window.removeEventListener('recix-import-stmt', onEvt)
  }, [])

  if (!visible) return null

  return (
    <div className="flex-shrink-0 border-b border-amber-500/35 bg-amber-500/10 px-4 py-2.5 flex items-center gap-3">
      <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
      <p className="text-sm text-amber-100 flex-1 min-w-0">
        <span className="font-semibold">Extrato importado.</span>
        {' '}
        Revise divergências, pagamentos sem venda e duplicidades na conciliação — o valor do produto está aí.
      </p>
      <Link
        to="/reconciliations?filter=divergent"
        className="flex-shrink-0 text-xs font-semibold text-amber-950 bg-amber-400 hover:bg-amber-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        Ver divergências
      </Link>
      <button
        type="button"
        onClick={() => { sessionStorage.removeItem(STORAGE_KEY); setVisible(false) }}
        className="flex-shrink-0 p-1 rounded-lg text-amber-200/80 hover:bg-amber-500/20 hover:text-amber-50"
        title="Dispensar aviso"
      >
        <X size={16} />
      </button>
    </div>
  )
}
