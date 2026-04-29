import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Link } from 'react-router-dom'
import { chargesService } from '../../services/chargesService'
import type { Charge } from '../../types'
import { formatCurrency } from '../../lib/formatters'

interface CreateChargeModalProps {
  onClose: () => void
  onCreated?: (charge: Charge) => void
}

export function CreateChargeModal({ onClose, onCreated }: CreateChargeModalProps) {
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState('')
  const [expiresInMinutes, setExpiresInMinutes] = useState('30')
  const [createdCharge, setCreatedCharge] = useState<Charge | null>(null)
  const [copied, setCopied] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]>>({})

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      chargesService.create({
        amount: parseFloat(amount),
        expiresInMinutes: parseInt(expiresInMinutes, 10),
      }),
    onSuccess: (charge) => {
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setCreatedCharge(charge)
      onCreated?.(charge)
    },
    onError: (err: Error & { validationErrors?: Record<string, string[]> }) => {
      if (err.validationErrors) setErrors(err.validationErrors)
    },
  })

  const amountNum = parseFloat(amount)
  const expiresNum = parseInt(expiresInMinutes, 10)
  const isValid = !isNaN(amountNum) && amountNum > 0 && !isNaN(expiresNum) && expiresNum > 0

  function resetForm() {
    setAmount('')
    setExpiresInMinutes('30')
    setCreatedCharge(null)
    setCopied(false)
    setErrors({})
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    mutate()
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={createdCharge ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-gray-50">
            {createdCharge ? 'Cobrança registrada para validação' : 'Nova Cobrança'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {createdCharge ? (
            <div className="space-y-4">
              {/* Success header */}
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-400">
                Cobrança registrada como pagamento esperado com sucesso
              </div>

              <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-3">
                <p className="text-xs text-gray-400">Valor esperado</p>
                <p className="text-sm font-semibold text-gray-100 mt-0.5">{formatCurrency(createdCharge.amount)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Expira em {new Date(createdCharge.expiresAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Esta cobrança será utilizada para validar automaticamente o pagamento recebido.
                </p>
              </div>

              {/* QR Code */}
              {createdCharge.pixCopiaECola ? (
                <div className="flex flex-col items-center gap-4">
                    <div className="bg-gray-900 border border-gray-800 p-3 rounded-xl shadow-lg">
                    <QRCodeSVG
                      value={createdCharge.pixCopiaECola}
                      size={200}
                      level="M"
                      includeMargin={false}
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Use este QR Code para simular ou realizar o pagamento
                  </p>

                  {/* PIX Copia e Cola */}
                  <div className="w-full">
                    <p className="text-xs text-gray-500 mb-1.5">PIX Copia e Cola</p>
                    <div className="flex items-start gap-2">
                      <textarea
                        readOnly
                        value={createdCharge.pixCopiaECola}
                        rows={3}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 px-3 py-2 text-xs font-mono resize-none focus:outline-none"
                      />
                      <button
                        onClick={() => handleCopy(createdCharge.pixCopiaECola!)}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                        title="Copiar código"
                      >
                        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      </button>
                    </div>
                    {copied && <p className="text-xs text-green-400 mt-1.5">Código PIX copiado com sucesso.</p>}
                    <p className="text-xs text-gray-500 mt-1.5">
                      Este código representa o pagamento esperado que será validado pelo RECIX.
                    </p>
                  </div>
                </div>
              ) : (
                /* Fake/dev mode — no real QR code */
                <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">Modo desenvolvimento</p>
                  <p className="text-xs text-gray-400">
                    QR Code disponível apenas com provedor PIX real (EfiBank configurado).
                  </p>
                  <p className="text-xs text-gray-500 mt-2 font-mono">{createdCharge.referenceId}</p>
                </div>
              )}

              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                <p className="text-xs font-semibold text-indigo-300 mb-1.5">Próximos passos</p>
                <ol className="text-xs text-gray-300 space-y-1 list-decimal pl-4">
                  <li>Envie o QR Code ou código PIX ao pagador.</li>
                  <li>O RECIX capturará automaticamente o evento de pagamento.</li>
                  <li>O sistema validará se o valor recebido corresponde ao esperado.</li>
                </ol>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
                <p className="text-xs font-semibold text-amber-300">MVP / Simulação</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/payment-events"
                  onClick={onClose}
                  className="text-center px-3 py-2 text-xs font-medium text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Ir para Eventos
                </Link>
                <Link
                  to="/reconciliations"
                  onClick={onClose}
                  className="text-center px-3 py-2 text-xs font-medium text-gray-200 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Ir para Conciliações
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error banner */}
              {error && !Object.keys(errors).length && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                  {(error as Error).message}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="150.75"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                  required
                />
                {errors['amount'] && (
                  <p className="mt-1 text-xs text-red-400">{errors['amount'].join(', ')}</p>
                )}
              </div>

              {isValid && (
                <div className="rounded-lg bg-gray-800/50 border border-gray-700 px-3 py-2 text-xs text-gray-300">
                  Você está criando uma cobrança de <span className="font-semibold text-gray-100">{formatCurrency(amountNum)}</span> com expiração em{' '}
                  <span className="font-semibold text-gray-100">{expiresNum} min</span>.
                </div>
              )}

              {/* Expires In Minutes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Expira em (minutos)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="30"
                  value={expiresInMinutes}
                  onChange={(e) => setExpiresInMinutes(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg text-gray-100 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors placeholder-gray-500"
                  required
                />
                {errors['expiresInMinutes'] && (
                  <p className="mt-1 text-xs text-red-400">{errors['expiresInMinutes'].join(', ')}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !isValid}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending && <Loader2 size={14} className="animate-spin" />}
                  {isPending ? 'Criando...' : 'Criar Cobrança'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer after success */}
        {createdCharge && (
          <div className="px-6 pb-5 flex gap-3">
            <button
              onClick={resetForm}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Nova cobrança
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
