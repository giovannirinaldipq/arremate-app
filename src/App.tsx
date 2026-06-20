import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Lotes from './pages/Lotes'
import LoteDetalhe from './pages/LoteDetalhe'
import ItemDetalhe from './pages/ItemDetalhe'
import ContasReceber from './pages/ContasReceber'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="lotes" element={<Lotes />} />
              <Route path="lotes/:id" element={<LoteDetalhe />} />
              <Route path="lotes/:loteId/itens/:itemId" element={<ItemDetalhe />} />
              <Route path="contas" element={<ContasReceber />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
