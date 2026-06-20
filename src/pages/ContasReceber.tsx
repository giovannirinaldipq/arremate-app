import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BRL, dtBR } from '../lib/calc'
import type { ContaReceber } from '../types'

export default function ContasReceber() {
  const [contas,  setContas]  = useState<ContaReceber[]>([])
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)
  const [pagando, setPagando] = useState<string | null>(null)

  async function load() {
    setLoading(true); setErro(null)
    try {
      const { data, error } = await supabase
        .from('contas_a_receber')
        .select('*')
        .order('vencimento')
      if (error) throw error
      setContas((data ?? []) as ContaReceber[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar contas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function marcarPago(parcela: ContaReceber) {
    setPagando(parcela.id)
    const hoje = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('parcelas')
      .update({ pago: true, pago_em: hoje })
      .eq('id', parcela.id)
    setPagando(null)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  if (loading) return <div className="empty-state">Carregando…</div>
  if (erro)    return <div className="empty-state" style={{ color: 'var(--red)' }}>Erro: {erro}</div>

  const hoje       = new Date()
  const vencidas   = contas.filter(c => c.vencida)
  const aVencer    = contas.filter(c => !c.vencida)
  const total      = contas.reduce((s, c) => s + Number(c.valor), 0)
  const totVenc    = vencidas.reduce((s, c) => s + Number(c.valor), 0)
  const totAberto  = aVencer.reduce((s, c) => s + Number(c.valor), 0)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Contas a receber</h1>
          <p>Parcelas em aberto. Vencidas aparecem em vermelho.</p>
        </div>
      </div>

      <div className="bento c3">
        <div className="kpi">
          <div className="k">Total a receber</div>
          <div className="v num">{BRL(total)}</div>
          <div className="sub">{contas.length} parcela{contas.length !== 1 ? 's' : ''} em aberto</div>
        </div>
        <div className="kpi">
          <div className="k">Vencido</div>
          <div className={`v num ${totVenc > 0 ? 'red' : 'green'}`}>{BRL(totVenc)}</div>
          <div className="sub">{vencidas.length} parcela{vencidas.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="kpi">
          <div className="k">A vencer</div>
          <div className="v num">{BRL(totAberto)}</div>
          <div className="sub">{aVencer.length} parcela{aVencer.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div className="panel">
        <div style={{ padding: 0 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Item</th>
                  <th>Parcela</th>
                  <th className="right">Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contas.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--mut)' }}>
                      Nada a receber. Tudo quitado. 🎉
                    </td>
                  </tr>
                )}
                {contas.map(c => {
                  const atrasada = c.vencida
                  const hoje2 = hoje
                  void hoje2 // used only for clarity
                  return (
                    <tr key={c.id} className={atrasada ? 'overdue' : ''}>
                      <td style={{ fontWeight: 600 }}>{c.cliente_nome}</td>
                      <td>
                        <span className="model-cell">{c.modelo}</span>{' '}
                        <span className="unit-id">#{String(c.item_id).slice(-4).toUpperCase()}</span>
                      </td>
                      <td className="num">{c.numero}ª</td>
                      <td className="right num">{BRL(Number(c.valor))}</td>
                      <td className="num">{dtBR(c.vencimento)}</td>
                      <td>
                        <span className={`badge ${atrasada ? 'vencido' : 'aberto'}`}>
                          {atrasada ? 'Vencida' : 'Em aberto'}
                        </span>
                      </td>
                      <td className="right">
                        <button
                          className="btn"
                          style={{ fontSize: 12, padding: '5px 10px' }}
                          onClick={() => marcarPago(c)}
                          disabled={pagando === c.id}
                        >
                          {pagando === c.id ? '…' : 'Marcar pago'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
