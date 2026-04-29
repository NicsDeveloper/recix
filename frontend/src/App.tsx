import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ChargesPage } from './pages/ChargesPage'
import { ChargeDetailPage } from './pages/ChargeDetailPage'
import { PaymentEventsPage } from './pages/PaymentEventsPage'
import { ReconciliationsPage } from './pages/ReconciliationsPage'
import { WebhookSimulatorPage } from './pages/WebhookSimulatorPage'

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
    </QueryClientProvider>
  )
}

export default App
