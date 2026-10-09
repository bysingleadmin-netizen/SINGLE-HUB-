import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { LoginPage } from '@/features/auth/LoginPage'
import { RotaLideranca } from '@/features/auth/RotaLideranca'
import { RotaProtegida } from '@/features/auth/RotaProtegida'
import { CalendarioPage } from '@/features/calendario/CalendarioPage'
import { CampanhaPage } from '@/features/campanhas/CampanhaPage'
import { CampanhasPage } from '@/features/campanhas/CampanhasPage'
import { ClientePage } from '@/features/clientes/ClientePage'
import { ClientesPage } from '@/features/clientes/ClientesPage'
import { ConfiguracoesPage } from '@/features/configuracoes/ConfiguracoesPage'
import { ConteudoPage } from '@/features/conteudo/ConteudoPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DemandasPage } from '@/features/demandas/DemandasPage'
import { FinanceiroPage } from '@/features/financeiro/FinanceiroPage'
import { AppLayout } from '@/layouts/AppLayout'
import { queryClient } from '@/lib/queryClient'
import { useRastroDoMouse } from '@/lib/rastroDoMouse'

function RedirecionarCampanha() {
  const { id } = useParams()
  return <Navigate to={`/app/anuncios/${id}`} replace />
}

export default function App() {
  useRastroDoMouse()

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
                  <Route path="clientes/:id" element={<ClientePage />} />
                  <Route path="demandas" element={<DemandasPage />} />
                  <Route path="conteudo" element={<ConteudoPage />} />
                  {/* O menu se chama Anúncios. No código e no banco a entidade continua
                      "campanha" (tabelas campaigns e campaign_tasks): renomear tabela quebraria
                      as políticas e os dados existentes sem mudar nada para quem usa. */}
                  <Route path="anuncios" element={<CampanhasPage />} />
                  <Route path="anuncios/:id" element={<CampanhaPage />} />
                  {/* Endereços antigos, ainda presentes em notificações já gravadas */}
                  <Route path="campanhas" element={<Navigate to="/app/anuncios" replace />} />
                  <Route path="campanhas/:id" element={<RedirecionarCampanha />} />
                  <Route path="calendario" element={<CalendarioPage />} />
                  <Route element={<RotaLideranca />}>
                    <Route path="financeiro/:aba?" element={<FinanceiroPage />} />
                  </Route>
                  <Route path="configuracoes" element={<ConfiguracoesPage />} />
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
