import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ChargesPage } from './pages/ChargesPage'
import { ChargeDetailPage } from './pages/ChargeDetailPage'
import { PaymentEventsPage } from './pages/PaymentEventsPage'
import { ReconciliationsPage } from './pages/ReconciliationsPage'
import { WebhookSimulatorPage } from './pages/WebhookSimulatorPage'
import { useRealtimeEvents } from './hooks/useRealtimeEvents'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppCore />
    </QueryClientProvider>
  )
}

/** Componente interno para poder usar hooks do QueryClient */
function AppCore() {
  useRealtimeEvents()

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/charges" element={<ChargesPage />} />
          <Route path="/charges/:id" element={<ChargeDetailPage />} />
          <Route path="/payment-events" element={<PaymentEventsPage />} />
          <Route path="/reconciliations" element={<ReconciliationsPage />} />
          <Route path="/webhooks/simulator" element={<WebhookSimulatorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
