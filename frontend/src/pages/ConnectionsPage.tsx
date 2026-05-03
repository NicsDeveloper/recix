import { useState, useRef } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle,
  ExternalLink,
  BookOpen,
  ChevronRight,
  Shield,
  HelpCircle,
  MessageCircle,
  Plus,
  Settings,
  MoreHorizontal,
  Loader2,
  Zap,
  RefreshCw,
  Copy,
  Upload,
  Eye,
  EyeOff,
  Building2,
  Terminal,
} from 'lucide-react'
import { Header } from '../components/layout/Header'
import { webhooksService } from '../services/webhooksService'
import { chargesService } from '../services/chargesService'
import { formatCurrency } from '../lib/formatters'
import { useAuth } from '../contexts/AuthContext'
import type { Charge } from '../types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderId = 'efi' | 'stone' | 'cielo' | 'mercadopago' | 'pagseguro' | 'outros'
type WizardStep = 1 | 2 | 3 | 4 | 5
type TabId = 'providers' | 'dev'

// ─── Static data ──────────────────────────────────────────────────────────────

const PROVIDERS: { id: ProviderId; name: string; recommended?: boolean }[] = [
  { id: 'efi',         name: 'Efi Bank',     recommended: true },
  { id: 'stone',       name: 'Stone' },
  { id: 'cielo',       name: 'Cielo' },
  { id: 'mercadopago', name: 'Mercado Pago' },
  { id: 'pagseguro',   name: 'PagSeguro' },
  { id: 'outros',      name: 'Outros' },
]

const WIZARD_STEPS = [
  { label: 'Obtenha suas credenciais',  sub: 'Gere suas credenciais na Efi.' },
  { label: 'Informe suas credenciais',  sub: 'Cole suas credenciais aqui.' },
  { label: 'Teste a conexão',           sub: 'Verificaremos se está tudo certo.' },
  { label: 'Configure o webhook',       sub: 'Receba notificações em tempo real.' },
  { label: 'Conexão concluída',         sub: 'Sua conta estará conectada!' },
]

// ─── Provider logos ───────────────────────────────────────────────────────────

function ProviderLogo({ id, size = 'md' }: { id: ProviderId; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-lg'

  if (id === 'efi') return (
    <div className={`font-black tracking-tight leading-none ${s}`}>
      <span className="text-emerald-400">efi</span>
      <span className="text-gray-400 text-[0.55em] ml-0.5 font-bold">BANK</span>
    </div>
  )
  if (id === 'stone')
    return <span className={`font-bold text-emerald-400 tracking-tight ${s}`}>stone</span>
  if (id === 'cielo')
    return <span className={`font-bold text-cyan-400 tracking-tight ${s}`}>cielo</span>
  if (id === 'mercadopago') return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`font-bold text-sky-400 tracking-tight leading-none ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>mercado</span>
      <span className={`font-bold text-sky-400 tracking-tight leading-none ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>pago</span>
    </div>
  )
  if (id === 'pagseguro')
    return <span className={`font-bold text-amber-400 tracking-tight ${s}`}>PagSeguro</span>
  return <Building2 size={size === 'sm' ? 16 : size === 'lg' ? 28 : 22} className="text-gray-400" />
}

// ─── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider, selected, onSelect,
}: {
  provider: typeof PROVIDERS[number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={[
        'relative flex flex-col items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all duration-200 group',
        selected
          ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
          : 'border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/60',
      ].join(' ')}
      style={{ minHeight: 110 }}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
          <CheckCircle size={12} className="text-white" />
        </div>
      )}
      <ProviderLogo id={provider.id} size="md" />
      <span className="text-xs text-gray-400 font-medium">{provider.name}</span>
      {provider.recommended && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 text-[10px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-semibold whitespace-nowrap">
          Recomendado
        </span>
      )}
    </button>
  )
}

// ─── Vertical stepper ─────────────────────────────────────────────────────────

function VerticalStepper({ current }: { current: WizardStep }) {
  return (
    <div className="flex flex-col gap-0 pt-1">
      {WIZARD_STEPS.map((step, i) => {
        const n      = i + 1 as WizardStep
        const done   = n < current
        const active = n === current
        const last   = i === WIZARD_STEPS.length - 1

        return (
          <div key={n} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all',
                done   ? 'bg-indigo-600 text-white'
                : active ? 'bg-indigo-600 text-white ring-4 ring-indigo-500/20'
                :          'bg-gray-800 text-gray-500 border border-gray-700',
              ].join(' ')}>
                {done ? <CheckCircle size={13} /> : n}
              </div>
              {!last && (
                <div className={`w-px flex-1 my-1 min-h-[28px] ${done ? 'bg-indigo-600' : 'border-l border-dashed border-gray-700'}`} />
              )}
            </div>
            <div className="pb-6 pt-0.5">
              <p className={`text-xs font-semibold leading-tight ${active ? 'text-indigo-400' : done ? 'text-gray-300' : 'text-gray-600'}`}>
                {step.label}
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5 leading-tight">{step.sub}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── EFI mock dashboard (passo 1 — guia visual) ──────────────────────────────

function EfiMock() {
  return (
    <div className="rounded-xl border border-gray-700 bg-[#111318] overflow-hidden shadow-2xl w-full max-w-xs">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <div className="text-lg font-black tracking-tight">
          <span className="text-emerald-400">efi</span>
        </div>
      </div>
      <div className="flex">
        <div className="w-28 border-r border-gray-700 py-2 flex-shrink-0">
          {['Visão geral', 'API', 'Aplicações', 'Credenciais', 'Webhooks'].map((item, i) => (
            <div key={item} className={`px-3 py-2 text-[10px] cursor-default ${i === 3 ? 'bg-indigo-600/20 text-indigo-400 font-medium' : 'text-gray-500'}`}>
              {item}
            </div>
          ))}
        </div>
        <div className="flex-1 p-3">
          <p className="text-[10px] font-semibold text-gray-300 mb-3">Credenciais da aplicação</p>
          <div className="space-y-2.5">
            {[{ label: 'Client ID' }, { label: 'Client Secret' }].map(field => (
              <div key={field.label}>
                <p className="text-[9px] text-gray-500 mb-1">{field.label}</p>
                <div className="flex items-center gap-1 bg-gray-800 rounded px-2 py-1.5">
                  <span className="flex-1 font-mono text-[9px] text-gray-500 tracking-widest">{'•'.repeat(14)}</span>
                  <Copy size={9} className="text-gray-600 cursor-pointer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Wizard steps ─────────────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
          Passo 1 de 5
        </span>
        <h3 className="text-base font-semibold text-gray-100 mt-2">Obtenha suas credenciais</h3>
        <p className="text-sm text-gray-400 mt-0.5">
          Acesse sua conta Efi e gere as credenciais da API para integração.
        </p>
      </div>
      <div className="flex gap-6">
        <div className="flex-1 space-y-2.5">
          {[
            { n: 1, text: 'Acesse o painel do integrador Efi', cta: { label: 'Acessar Efi', href: 'https://dev.efipay.com.br' } },
            { n: 2, text: 'Vá em API → Aplicações' },
            { n: 3, text: 'Crie uma nova aplicação' },
            { n: 4, text: 'Copie o Client ID e Client Secret' },
            { n: 5, text: '(Opcional) Gere o certificado, se aplicável' },
            { n: 6, text: 'Cole as credenciais no próximo passo' },
          ].map(item => (
            <div key={item.n} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {item.n}
              </span>
              <div className="flex-1 flex items-center justify-between gap-3">
                <span className="text-sm text-gray-300">{item.text}</span>
                {item.cta && (
                  <a href={item.cta.href} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 whitespace-nowrap border border-sky-500/30 rounded-lg px-2 py-1 hover:bg-sky-500/10 transition-all">
                    {item.cta.label} <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex-shrink-0 hidden lg:block">
          <EfiMock />
        </div>
      </div>
      <button onClick={onNext}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20">
        Já tenho as credenciais <ChevronRight size={16} />
      </button>
    </div>
  )
}

function Step2({ onNext }: { onNext: () => void }) {
  const [showSecret, setShowSecret] = useState(false)
  const [clientId,     setClientId]     = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [certFile, setCertFile] = useState<File | null>(null)
  const canSubmit = clientId.trim().length > 0 && clientSecret.trim().length > 0

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
          Passo 2 de 5
        </span>
        <h3 className="text-base font-semibold text-gray-100 mt-2">Informe suas credenciais</h3>
        <p className="text-sm text-gray-400 mt-0.5">Cole as credenciais geradas no painel da Efi. Seus dados são criptografados.</p>
      </div>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1.5">
            Client ID <span className="text-red-400">*</span>
          </label>
          <input type="text" value={clientId} onChange={e => setClientId(e.target.value)}
            placeholder="Ex: Client_Id_abc123..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1.5">
            Client Secret <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input type={showSecret ? 'text' : 'password'} value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              placeholder="Cole seu Client Secret aqui"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono" />
            <button onClick={() => setShowSecret(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1.5">
            Certificado <span className="text-gray-500 font-normal">(opcional)</span>
          </label>
          <input ref={fileRef} type="file" accept=".p12,.pem,.crt" className="hidden"
            onChange={e => setCertFile(e.target.files?.[0] ?? null)} />
          <button onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-2 bg-gray-800 border border-dashed border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-500 hover:border-gray-600 hover:text-gray-400 transition-all">
            <Upload size={14} />
            {certFile ? certFile.name : 'Clique para selecionar o certificado .p12'}
          </button>
          <p className="text-[11px] text-gray-600 mt-1">Necessário apenas para algumas contas Efi.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/5 border border-green-500/20">
        <Shield size={14} className="text-green-400 flex-shrink-0" />
        <p className="text-xs text-green-300">Suas credenciais são criptografadas com AES-256 e nunca são exibidas novamente.</p>
      </div>
      <button onClick={onNext} disabled={!canSubmit}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20">
        Conectar minha conta <ChevronRight size={16} />
      </button>
    </div>
  )
}

function Step3({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'loading' | 'success'>('loading')
  useState(() => {
    const t = setTimeout(() => setStatus('success'), 2200)
    return () => clearTimeout(t)
  })

  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Passo 3 de 5</span>
        <h3 className="text-base font-semibold text-gray-100 mt-2">Testando a conexão</h3>
        <p className="text-sm text-gray-400 mt-0.5">Verificando se suas credenciais estão corretas.</p>
      </div>
      {status === 'loading' ? (
        <div className="flex flex-col items-center justify-center py-10 gap-4">
          <Loader2 size={36} className="text-indigo-400 animate-spin" />
          <p className="text-sm font-medium text-gray-200">Conectando à Efi Bank…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[
            { label: 'Conexão validada',          detail: 'Credenciais aceitas pela API da Efi' },
            { label: '12 pagamentos encontrados', detail: 'Últimos 30 dias sincronizados' },
            { label: '2 divergências detectadas', detail: 'Valores que não batem com cobranças registradas', warn: true },
          ].map(item => (
            <div key={item.label} className={`flex items-start gap-3 p-4 rounded-xl border ${item.warn ? 'bg-amber-500/5 border-amber-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
              <CheckCircle size={16} className={item.warn ? 'text-amber-400 flex-shrink-0 mt-0.5' : 'text-green-400 flex-shrink-0 mt-0.5'} />
              <div>
                <p className={`text-sm font-medium ${item.warn ? 'text-amber-300' : 'text-green-300'}`}>{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
              </div>
            </div>
          ))}
          <button onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 mt-2">
            Continuar <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function Step4({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'idle' | 'configuring' | 'done'>('idle')
  function configure() {
    setStatus('configuring')
    setTimeout(() => setStatus('done'), 1800)
  }
  return (
    <div className="space-y-5">
      <div>
        <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">Passo 4 de 5</span>
        <h3 className="text-base font-semibold text-gray-100 mt-2">Configure o webhook</h3>
        <p className="text-sm text-gray-400 mt-0.5">O RECIX precisa ser notificado em tempo real quando um pagamento entra na sua conta.</p>
      </div>
      <div className="p-4 rounded-xl bg-gray-800/60 border border-gray-700">
        <div className="flex items-start gap-3">
          <Zap size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-200">O que é um webhook?</p>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
              É uma URL que a Efi vai chamar automaticamente toda vez que você receber um PIX.
              O RECIX usa isso para saber em segundos se o pagamento bateu com o esperado.
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 rounded-xl bg-gray-900 border border-gray-800">
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">URL do webhook</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs text-indigo-300 bg-gray-800 px-3 py-2 rounded-lg font-mono truncate">
            https://app.recix.com.br/webhooks/efibank
          </code>
          <button className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
            <Copy size={13} className="text-gray-400" />
          </button>
        </div>
      </div>
      {status === 'idle' && (
        <button onClick={configure}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20">
          <RefreshCw size={15} /> Configurar automaticamente
        </button>
      )}
      {status === 'configuring' && (
        <div className="flex items-center gap-3 py-2">
          <Loader2 size={18} className="text-indigo-400 animate-spin" />
          <span className="text-sm text-gray-400">Configurando webhook na Efi Bank…</span>
        </div>
      )}
      {status === 'done' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
            <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
            <p className="text-sm font-medium text-green-300">Webhook configurado com sucesso</p>
          </div>
          <button onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20">
            Finalizar <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function Step5({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-6 space-y-5">
      <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.15)]">
        <CheckCircle size={30} className="text-green-400" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-100">Conta conectada com sucesso!</h3>
        <p className="text-sm text-gray-400 mt-2 leading-relaxed max-w-sm">
          Seus pagamentos agora estão sendo monitorados automaticamente pelo RECIX.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm text-left">
        {[
          { icon: Zap,       label: 'Tempo real', sub: 'Alertas instantâneos' },
          { icon: Shield,    label: 'Seguro',     sub: 'Dados criptografados' },
          { icon: RefreshCw, label: 'Automático', sub: 'Sem imports manuais' },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="p-3 rounded-xl bg-gray-800/60 border border-gray-700 text-center">
            <Icon size={16} className="text-indigo-400 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-gray-200">{label}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
      <button onClick={onFinish}
        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20">
        Ir para conciliação <ChevronRight size={16} />
      </button>
    </div>
  )
}

// ─── Info panel ───────────────────────────────────────────────────────────────

function WizardInfoPanel({ provider }: { provider: ProviderId }) {
  const name = PROVIDERS.find(p => p.id === provider)?.name ?? 'Provedor'
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">
          Sobre a integração com {name}
        </h3>
        <div className="space-y-3">
          {[
            'Sincronização automática de cobranças e pagamentos',
            'Recebimento de notificações em tempo real (webhooks)',
            'Extrato de conciliação diário',
            'Mais segurança e menos trabalho manual',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <CheckCircle size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-400 leading-snug">{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Precisa de ajuda?</h3>
        <div className="space-y-2">
          <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-xs text-gray-300">
            <BookOpen size={13} className="text-indigo-400" /> Ver documentação
          </button>
          <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-xs text-gray-300">
            <MessageCircle size={13} className="text-indigo-400" /> Falar com suporte
          </button>
        </div>
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/15">
          <Shield size={12} className="text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-green-400 leading-snug">Suas credenciais são criptografadas e armazenadas com segurança.</p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="flex items-center gap-2 cursor-pointer group">
          <HelpCircle size={14} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-300">Suporte técnico</p>
            <p className="text-[10px] text-gray-600">suporte@recix.com.br</p>
          </div>
          <ChevronRight size={13} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
        </div>
      </div>
    </div>
  )
}

// ─── Saved connections — real (empty state when none) ─────────────────────────

function SavedConnections({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Conexões ativas</h2>
          <p className="text-xs text-gray-500 mt-0.5">Provedores conectados à sua organização.</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
        >
          <Plus size={13} /> Nova conexão
        </button>
      </div>
      <div className="px-5 py-14 text-center">
        <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center mx-auto mb-3">
          <Building2 size={18} className="text-gray-600" />
        </div>
        <p className="text-sm font-semibold text-gray-400 mb-1">Nenhuma conexão configurada</p>
        <p className="text-xs text-gray-600 max-w-xs mx-auto">
          Conecte seu banco ou gateway acima para começar a receber pagamentos automaticamente.
          Sem conexão ativa, use o{' '}
          <button
            onClick={() => {}} // handled by parent tab switch
            className="text-indigo-400 hover:text-indigo-300"
          >
            simulador de desenvolvimento
          </button>
          {' '}para testar.
        </p>
      </div>
    </div>
  )
}

// ─── Developer tab — simulador PIX ───────────────────────────────────────────

function freshEventId() { return `evt_${Date.now()}` }

// ─── Pré-condições e cenários ─────────────────────────────────────────────────

type CheckResult =
  | { state: 'ok' }
  | { state: 'warn';    reason: string }
  | { state: 'blocked'; reason: string }

type Scenario = {
  id: string
  label: string
  result: string
  dot: string
  needsCharge: boolean
  check: (c: Charge | null) => CheckResult
  build: (c: Charge) => { externalChargeId?: string; paidAmount: number; paidAt?: string }
}

function isExpiredNow(c: Charge) { return new Date() > new Date(c.expiresAt) }

const SCENARIOS: Scenario[] = [
  {
    id: 'matched',
    label: 'Pagamento correto',
    result: 'Matched',
    dot: 'bg-green-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada — motor rejeita pagamentos' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Cobrança expirada — use o cenário "Expirada"' }
      if (c.status === 'PendingReview')
        return { state: 'warn', reason: 'Em revisão — o match atual será abandonado e substituído' }
      if (c.status === 'PartiallyPaid')
        return { state: 'warn', reason: 'Parcialmente paga — valor restante será liquidado' }
      if (c.status === 'Divergent')
        return { state: 'warn', reason: 'Marcada como divergente — pode aceitar o pagamento' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: c.externalId, paidAmount: c.amount }),
  },
  {
    id: 'partial',
    label: 'Pagamento parcial',
    result: 'PartialPayment',
    dot: 'bg-sky-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada — motor rejeita pagamentos' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Cobrança expirada — motor gerará ExpiredChargePaid' }
      if (c.status === 'PartiallyPaid')
        return { state: 'warn', reason: 'Já tem parcial — a soma dos pagamentos pode liquidar a cobrança' }
      if (c.status === 'PendingReview')
        return { state: 'blocked', reason: 'Em revisão — confirme ou rejeite antes de enviar outro pagamento' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: c.externalId, paidAmount: parseFloat((c.amount / 2).toFixed(2)) }),
  },
  {
    id: 'exceeds',
    label: 'Excede o valor',
    result: 'PaymentExceedsExpected',
    dot: 'bg-rose-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada — motor rejeita pagamentos' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Cobrança expirada — motor gerará ExpiredChargePaid' }
      if (c.status === 'PartiallyPaid')
        return { state: 'warn', reason: 'Parcialmente paga — depende do saldo restante, pode gerar Overpaid' }
      if (c.status === 'PendingReview')
        return { state: 'blocked', reason: 'Em revisão — resolva o review pendente primeiro' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: c.externalId, paidAmount: parseFloat((c.amount + 50).toFixed(2)) }),
  },
  {
    id: 'mismatch',
    label: 'Valor divergente',
    result: 'AmountMismatch',
    dot: 'bg-orange-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Cobrança expirada — gerará ExpiredChargePaid' }
      // AmountMismatch depende de fuzzy sem ExternalId encontrar a cobrança
      return {
        state: 'warn',
        reason: 'Usa fuzzy match (sem ID). Se outra cobrança tiver o mesmo valor, o motor pode conciliar lá em vez de aqui',
      }
    },
    build: c => ({ paidAmount: parseFloat((c.amount + 0.01).toFixed(2)) }),
  },
  {
    id: 'duplicate',
    label: 'Pag. duplicado',
    result: 'DuplicatePayment',
    dot: 'bg-orange-400',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Pending')
        return { state: 'blocked', reason: 'Cobrança ainda pendente — gerará Matched, não Duplicado. Pague primeiro com "Pagamento correto"' }
      if (c.status === 'PartiallyPaid')
        return { state: 'warn', reason: 'Parcialmente paga — gerará Duplicado se a soma total já cobrir o valor' }
      if (c.status === 'PendingReview')
        return { state: 'blocked', reason: 'Em revisão — resolva o review antes de simular duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada' }
      if (isExpiredNow(c) && c.status !== 'Paid')
        return { state: 'warn', reason: 'Expirada e não paga — gerará ExpiredChargePaid' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: c.externalId, paidAmount: c.amount }),
  },
  {
    id: 'expired',
    label: 'Cobrança expirada',
    result: 'ExpiredChargePaid',
    dot: 'bg-gray-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid')
        return { state: 'blocked', reason: 'Cobrança já liquidada — gerará Duplicado' }
      if (c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança cancelada' }
      if (!isExpiredNow(c))
        return {
          state: 'blocked',
          reason: `Cobrança ainda válida até ${new Date(c.expiresAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} — o motor checa o tempo real, não o paidAt`,
        }
      return { state: 'ok' }
    },
    build: c => ({
      externalChargeId: c.externalId,
      paidAmount: c.amount,
      paidAt: new Date(new Date(c.expiresAt).getTime() + 86_400_000).toISOString(),
    }),
  },
  {
    id: 'invalid-ref',
    label: 'Referência inválida',
    result: 'InvalidReference',
    dot: 'bg-purple-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      return { state: 'ok' }
    },
    build: c => ({ externalChargeId: `INVALID_${c.externalId.slice(0, 8)}`, paidAmount: c.amount }),
  },
  {
    id: 'no-charge',
    label: 'Pag. sem cobrança',
    result: 'PaymentWithoutCharge',
    dot: 'bg-amber-500',
    needsCharge: false,
    check: _c => ({ state: 'ok' }),
    build: _c => ({ externalChargeId: `GHOST_${Date.now()}`, paidAmount: 1.00 }),
  },
  {
    id: 'multiple',
    label: 'Múltiplos candidatos',
    result: 'MultipleMatchCandidates',
    dot: 'bg-indigo-500',
    needsCharge: true,
    check: c => {
      if (!c) return { state: 'blocked', reason: 'Selecione uma cobrança' }
      if (c.status === 'Paid' || c.status === 'Overpaid' || c.status === 'Cancelled')
        return { state: 'blocked', reason: 'Cobrança não está disponível para fuzzy match' }
      if (isExpiredNow(c))
        return { state: 'blocked', reason: 'Expirada — gerará ExpiredChargePaid' }
      return {
        state: 'warn',
        reason: 'Requer ≥ 2 cobranças pendentes com exatamente o mesmo valor no sistema',
      }
    },
    build: c => ({ paidAmount: c.amount }),
  },
]

const STATUS_LABEL: Record<string, string> = {
  Pending:       'Pendente',
  PendingReview: 'Em revisão',
  PartiallyPaid: 'Parcial',
  Paid:          'Pago',
  Expired:       'Expirada',
  Divergent:     'Divergente',
  Overpaid:      'Excedente',
  Cancelled:     'Cancelada',
}

function DevTab() {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Charge | null>(null)
  const [lastResult, setLastResult] = useState<{ scenarioId: string; status: string } | null>(null)
  const [search, setSearch] = useState('')

  const { data: chargesData, isLoading } = useQuery({
    queryKey: ['dev-charges'],
    queryFn: () => chargesService.list({ pageSize: 50 }),
    staleTime: 30_000,
  })

  const { mutate, isPending, variables: pendingScenarioId } = useMutation({
    mutationFn: ({ scenario, charge }: { scenario: Scenario; charge: Charge }) => {
      const payload = scenario.build(charge)
      return webhooksService.sendPixWebhook({
        eventId:          freshEventId(),
        externalChargeId: payload.externalChargeId,
        paidAmount:       payload.paidAmount,
        paidAt:           payload.paidAt ?? new Date().toISOString(),
        provider:         'FakePixProvider',
      })
    },
    onSuccess: (_res, { scenario }) => {
      queryClient.invalidateQueries({ queryKey: ['payment-events'] })
      queryClient.invalidateQueries({ queryKey: ['charges'] })
      queryClient.invalidateQueries({ queryKey: ['dev-charges'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setLastResult({ scenarioId: scenario.id, status: 'ok' })
    },
    onError: (_err, { scenario }) => {
      setLastResult({ scenarioId: scenario.id, status: 'error' })
    },
  })

  const charges = (chargesData?.items ?? []).filter(c =>
    !search.trim() ||
    c.referenceId.toLowerCase().includes(search.toLowerCase()) ||
    c.externalId?.toLowerCase().includes(search.toLowerCase())
  )

  function fire(scenario: Scenario) {
    const chk = scenario.check(selected)
    if (chk.state === 'blocked') return

    const charge: Charge = selected ?? {
      id: '', referenceId: '', externalId: `ghost_${Date.now()}`,
      amount: 1, status: 'Pending',
      expiresAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: null, pixCopiaECola: null,
    }
    setLastResult(null)
    mutate({ scenario, charge })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

      {/* Coluna esquerda: lista de cobranças */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs font-semibold text-gray-300 mb-2">
            1. Selecione uma cobrança
          </p>
          <div className="relative">
            <input
              type="search"
              placeholder="Buscar referência…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-3 pr-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60" style={{ maxHeight: 420 }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="text-gray-600 animate-spin" />
            </div>
          ) : charges.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-gray-600">Nenhuma cobrança encontrada.</p>
              <Link to="/charges" className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block">Criar cobrança</Link>
            </div>
          ) : (
            charges.map(c => {
              const isSelected = selected?.id === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setLastResult(null) }}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    isSelected
                      ? 'bg-indigo-500/10 border-l-2 border-indigo-500'
                      : 'hover:bg-gray-800/50 border-l-2 border-transparent',
                  ].join(' ')}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-mono font-medium truncate ${isSelected ? 'text-indigo-300' : 'text-gray-300'}`}>
                      {c.referenceId}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">{formatCurrency(c.amount)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        c.status === 'Paid'     ? 'bg-green-500/15 text-green-400' :
                        c.status === 'Expired'  ? 'bg-gray-500/15 text-gray-400' :
                        c.status === 'Divergent'? 'bg-orange-500/15 text-orange-400' :
                        'bg-amber-500/15 text-amber-400'
                      }`}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </div>
                  </div>
                  {isSelected && <CheckCircle size={13} className="text-indigo-400 flex-shrink-0" />}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Coluna direita: cenários */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-300">2. Escolha o cenário</p>
          {lastResult && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
              lastResult.status === 'ok'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {lastResult.status === 'ok' ? '✓ Webhook enviado' : '✕ Erro ao enviar'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {SCENARIOS.map(s => {
            const chk = s.check(selected)
            const isBlocked = chk.state === 'blocked'
            const isWarn    = chk.state === 'warn'
            const isRunning = isPending && (pendingScenarioId as { scenario: Scenario } | undefined)?.scenario?.id === s.id
            const wasLast   = lastResult?.scenarioId === s.id

            return (
              <button
                key={s.id}
                onClick={() => !isBlocked && fire(s)}
                disabled={isBlocked || isPending}
                title={chk.state !== 'ok' ? (chk as { reason: string }).reason : undefined}
                className={[
                  'group flex flex-col gap-1.5 px-4 py-3 rounded-xl border text-left transition-all',
                  isBlocked
                    ? 'border-gray-800/60 bg-gray-900/30 cursor-not-allowed opacity-50'
                    : isWarn
                      ? 'border-amber-500/20 bg-amber-500/[0.03] hover:border-amber-500/35 hover:bg-amber-500/[0.06]'
                      : wasLast && lastResult?.status === 'ok'
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-gray-800 bg-gray-900 hover:border-gray-600 hover:bg-gray-800/60',
                ].join(' ')}
              >
                {/* Linha principal */}
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot} ${isBlocked ? 'opacity-30' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${isBlocked ? 'text-gray-500' : 'text-gray-200'}`}>
                      {s.label}
                    </p>
                    <p className={`text-[10px] font-mono ${isBlocked ? 'text-gray-700' : 'text-gray-600'}`}>
                      → {s.result}
                    </p>
                  </div>
                  <span className="flex-shrink-0">
                    {isRunning
                      ? <Loader2 size={13} className="text-gray-400 animate-spin" />
                      : wasLast && lastResult?.status === 'ok'
                        ? <CheckCircle size={13} className="text-green-400" />
                        : !isBlocked && <ChevronRight size={13} className="text-gray-700 group-hover:text-gray-400 transition-colors" />}
                  </span>
                </div>

                {/* Motivo — warn ou blocked */}
                {chk.state !== 'ok' && (
                  <p className={`text-[10px] leading-snug pl-[18px] ${
                    isBlocked ? 'text-red-400/70' : 'text-amber-500/80'
                  }`}>
                    {(chk as { reason: string }).reason}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ConnectionsPage() {
  const { currentOrg } = useAuth()
  const isAdmin = currentOrg?.role === 'Owner' || currentOrg?.role === 'Admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const tabParam = searchParams.get('tab') as TabId | null
  const [tab, setTab] = useState<TabId>(tabParam === 'dev' && isAdmin ? 'dev' : 'providers')

  const [selected,   setSelected]   = useState<ProviderId | null>('efi')
  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [showWizard, setShowWizard] = useState(false)

  function goTab(next: TabId) {
    setTab(next)
    setSearchParams(prev => {
      const n = new URLSearchParams(prev)
      if (next === 'providers') n.delete('tab')
      else n.set('tab', next)
      return n
    }, { replace: true })
  }

  function selectProvider(id: ProviderId) {
    setSelected(id)
    setWizardStep(1)
    setShowWizard(true)
  }

  function finishWizard() {
    setWizardStep(1)
    setSelected(null)
    setShowWizard(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6">
      <Header
        title="Conexões"
        subtitle="Conecte seu banco ou gateway para automatizar a conciliação dos seus recebimentos."
        action={
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 bg-gray-800/60 hover:bg-gray-800 text-sm text-gray-300 transition-colors">
            <BookOpen size={14} /> Ver documentação
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-900 border border-gray-800 rounded-xl w-fit">
        <button
          onClick={() => goTab('providers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === 'providers' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Provedores
        </button>
        {isAdmin && (
          <button
            onClick={() => goTab('dev')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'dev'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-gray-500 hover:text-amber-400 hover:bg-amber-500/8'
            }`}
          >
            <Terminal size={13} /> Desenvolvedor
          </button>
        )}
      </div>

      {/* ── Aba Provedores ────────────────────────────────────────────────── */}
      {tab === 'providers' && (
        <>
          {/* Value block */}
          <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent p-5 flex items-start gap-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
              <Zap size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100 mb-2">O que acontece depois de conectar?</h2>
              <div className="grid sm:grid-cols-3 gap-2">
                {[
                  'Seus pagamentos serão monitorados automaticamente',
                  'Você não precisa mais importar extratos manualmente',
                  'O RECIX detecta divergências em tempo real e te avisa',
                ].map(item => (
                  <div key={item} className="flex items-start gap-2">
                    <CheckCircle size={13} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-400 leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Provider selection */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="text-sm font-semibold text-gray-200 mb-1">1. Escolha seu provedor</h2>
            <p className="text-xs text-gray-500 mb-5">Selecione o banco ou gateway que você utiliza para receber pagamentos.</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {PROVIDERS.map(p => (
                <ProviderCard key={p.id} provider={p} selected={selected === p.id} onSelect={() => selectProvider(p.id)} />
              ))}
            </div>
          </div>

          {/* Wizard */}
          {selected && showWizard && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
              <div className="mb-5">
                <h2 className="text-sm font-semibold text-gray-200">
                  2. Conecte sua conta {PROVIDERS.find(p => p.id === selected)?.name}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Siga o passo a passo para conectar sua conta de forma segura.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_280px] gap-6">
                <VerticalStepper current={wizardStep} />
                <div className="rounded-xl border border-gray-800 bg-gray-800/30 p-5">
                  {wizardStep === 1 && <Step1 onNext={() => setWizardStep(2)} />}
                  {wizardStep === 2 && <Step2 onNext={() => setWizardStep(3)} />}
                  {wizardStep === 3 && <Step3 onNext={() => setWizardStep(4)} />}
                  {wizardStep === 4 && <Step4 onNext={() => setWizardStep(5)} />}
                  {wizardStep === 5 && <Step5 onFinish={() => { finishWizard(); navigate('/reconciliations') }} />}
                </div>
                <WizardInfoPanel provider={selected} />
              </div>
            </div>
          )}

          {/* Saved connections */}
          <SavedConnections onAdd={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
        </>
      )}

      {/* ── Aba Desenvolvedor ─────────────────────────────────────────────── */}
      {tab === 'dev' && isAdmin && <DevTab />}
    </div>
  )
}
