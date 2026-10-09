import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RotaLideranca } from '@/features/auth/RotaLideranca'
import { RotaProtegida } from '@/features/auth/RotaProtegida'
import { CampanhaPage } from '@/features/campanhas/CampanhaPage'
import { CampanhasPage } from '@/features/campanhas/CampanhasPage'
import { ClientesPage } from '@/features/clientes/ClientesPage'
import { ConteudoPage } from '@/features/conteudo/ConteudoPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DemandasPage } from '@/features/demandas/DemandasPage'
import { EmConstrucao } from '@/features/placeholder/EmConstrucao'
import { AppLayout } from '@/layouts/AppLayout'
import { queryClient } from '@/lib/queryClient'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RotaProtegida />}>
                <Route path="/app" element={<AppLayout />}>
                  <Route index element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="clientes" element={<ClientesPage />} />
                  <Route path="demandas" element={<DemandasPage />} />
                  <Route path="conteudo" element={<ConteudoPage />} />
                  <Route path="campanhas" element={<CampanhasPage />} />
                  <Route path="campanhas/:id" element={<CampanhaPage />} />
                  <Route element={<RotaLideranca />}>
                    <Route
                      path="financeiro/:aba?"
                      element={<EmConstrucao tela="Financeiro" etapa={3} />}
                    />
                  </Route>
                  <Route
                    path="configuracoes"
                    element={<EmConstrucao tela="Configurações" etapa={2} />}
                  />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}
