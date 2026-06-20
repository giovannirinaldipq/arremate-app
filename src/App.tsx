import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Lotes from './pages/Lotes'
import LoteDetalhe from './pages/LoteDetalhe'
import ItemDetalhe from './pages/ItemDetalhe'
import ContasReceber from './pages/ContasReceber'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="lotes" element={<Lotes />} />
          <Route path="lotes/:id" element={<LoteDetalhe />} />
          <Route path="lotes/:loteId/itens/:itemId" element={<ItemDetalhe />} />
          <Route path="contas" element={<ContasReceber />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
