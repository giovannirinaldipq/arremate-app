import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BRL, dtBR } from '../lib/calc'
import type { Lote, CustoExtra, ItemCalculado } from '../types'
import SaleModal, { type SaleItem } from '../components/SaleModal'

type Filtro = 'todos' | 'avaliar' | 'estoque' | 'vendido'

interface EditLoteForm {
  origem: string; data_arremate: string; data_retirada: string
  valor_lote: string; status: 'ativo' | 'encerrado'
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 14, padding: '2px 5px', color: 'var(--mut)',
  borderRadius: 4, lineHeight: 1,
}

export default function LoteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [lote,    setLote]    = useState<Lote | null>(null)
  const [extras,  setExtras]  = useState<CustoExtra[]>([])
  const [itens,   setItens]   = useState<ItemCalculado[]>([])
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)
  const [filtro,  setFiltro]  = useState<Filtro>('todos')

  // venda inline
  const [saleItem, setSaleItem] = useState<SaleItem | null>(null)

  // ── editar lote ─────────────────────────────────────────────────────────
  const [showEditLote,   setShowEditLote]   = useState(false)
  const [editLoteForm,   setEditLoteForm]   = useState<EditLoteForm>({ origem: '', data_arremate: '', data_retirada: '', valor_lote: '', status: 'ativo' })
  const [savingEditLote, setSavingEditLote] = useState(false)

  // ── adicionar custo ──────────────────────────────────────────────────────
  const [showAddCusto, setShowAddCusto] = useState(false)
  const [custoTipo,    setCustoTipo]    = useState('')
  const [custoValor,   setCustoValor]   = useState('')
  const [savingCusto,  setSavingCusto]  = useState(false)

  // ── editar custo ─────────────────────────────────────────────────────────
  const [editExtra,       setEditExtra]       = useState<CustoExtra | null>(null)
  const [editExtraTipo,   setEditExtraTipo]   = useState('')
  const [editExtraValor,  setEditExtraValor]  = useState('')
  const [savingEditExtra, setSavingEditExtra] = useState(false)

  // ── adicionar item ───────────────────────────────────────────────────────
  const [showAddItem,  setShowAddItem]  = useState(false)
  const [itemModelo,   setItemModelo]   = useState('')
  const [itemRef,      setItemRef]      = useState('')
  const [itemCondicao, setItemCondicao] = useState<'ok' | 'defeito'>('ok')
  const [itemConserto, setItemConserto] = useState('')
  const [itemStatus,   setItemStatus]   = useState<'avaliar' | 'estoque'>('avaliar')
  const [savingItem,   setSavingItem]   = useState(false)

  async function load() {
    if (!id) return
    setLoading(true); setErro(null)
    try {
      const [loteRes, extrasRes, itensRes] = await Promise.all([
        supabase.from('lotes').select('*').eq('id', id).single(),
        supabase.from('custos_extras').select('*').eq('lote_id', id).order('created_at'),
        supabase.from('itens_calculados').select('*').eq('lote_id', id).order('created_at'),
      ])
      if (loteRes.error)   throw loteRes.error
      if (extrasRes.error) throw extrasRes.error
      setLote(loteRes.data as Lote)
      setExtras(extrasRes.data ?? [])
      setItens((itensRes.data ?? []) as ItemCalculado[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar lote.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  // ── computed ─────────────────────────────────────────────────────────────
  const totalExtras    = extras.reduce((s, e) => s + Number(e.valor), 0)
  const custoTotal     = lote ? Number(lote.valor_lote) + totalExtras : 0
  const vendidos       = itens.filter(i => i.status === 'vendido')
  const totalVendido   = vendidos.reduce((s, i) => s + Number(i.preco_venda ?? 0), 0)
  const lucro          = vendidos.reduce((s, i) => s + Number(i.lucro_item ?? 0), 0)
  const falta          = Math.max(0, custoTotal - totalVendido)
  const pct            = custoTotal > 0 ? Math.min(100, totalVendido / custoTotal * 100) : 0
  const breakEven      = totalVendido >= custoTotal
  const cor            = breakEven ? 'var(--green)' : 'var(--amber)'

  const naoVendidos      = itens.filter(i => i.status !== 'vendido')
  const possibilidade    = naoVendidos.reduce((s, i) => s + Number(i.preco_sugerido ?? 0), 0)
  const lucroPotencial   = totalVendido + possibilidade - custoTotal
  const pctLucroPot      = custoTotal > 0 ? (lucroPotencial / custoTotal * 100) : 0

  const itensFiltrados = filtro === 'todos' ? itens : itens.filter(i => i.status === filtro)
  const counts = {
    todos:   itens.length,
    avaliar: itens.filter(i => i.status === 'avaliar').length,
    estoque: itens.filter(i => i.status === 'estoque').length,
    vendido: itens.filter(i => i.status === 'vendido').length,
  }

  // ── editar lote ──────────────────────────────────────────────────────────
  function abrirEditLote() {
    if (!lote) return
    setEditLoteForm({
      origem:        lote.origem,
      data_arremate: lote.data_arremate ?? '',
      data_retirada: lote.data_retirada ?? '',
      valor_lote:    String(lote.valor_lote),
      status:        lote.status as 'ativo' | 'encerrado',
    })
    setShowEditLote(true)
  }
  async function salvarEditLote() {
    if (!id) return
    if (!editLoteForm.origem.trim()) { alert('Informe a origem.'); return }
    const val = parseFloat(editLoteForm.valor_lote.replace(',', '.'))
    if (!val || val <= 0) { alert('Informe um valor válido.'); return }
    setSavingEditLote(true)
    const { error } = await supabase.from('lotes').update({
      origem:        editLoteForm.origem.trim(),
      data_arremate: editLoteForm.data_arremate || null,
      data_retirada: editLoteForm.data_retirada || null,
      valor_lote:    val,
      status:        editLoteForm.status,
    }).eq('id', id)
    setSavingEditLote(false)
    if (error) { alert('Erro: ' + error.message); return }
    setShowEditLote(false); load()
  }

  // ── custo extra ──────────────────────────────────────────────────────────
  async function salvarCusto() {
    if (!id) return
    if (!custoTipo.trim()) { alert('Informe o tipo.'); return }
    const val = parseFloat(custoValor.replace(',', '.'))
    if (!val || val <= 0) { alert('Informe um valor válido.'); return }
    setSavingCusto(true)
    const { error } = await supabase.from('custos_extras').insert({ lote_id: id, tipo: custoTipo.trim(), valor: val })
    setSavingCusto(false)
    if (error) { alert('Erro: ' + error.message); return }
    setCustoTipo(''); setCustoValor(''); setShowAddCusto(false); load()
  }
  function abrirEditExtra(e: CustoExtra) {
    setEditExtra(e); setEditExtraTipo(e.tipo); setEditExtraValor(String(e.valor))
  }
  async function salvarEditExtra() {
    if (!editExtra) return
    const val = parseFloat(editExtraValor.replace(',', '.'))
    if (!editExtraTipo.trim() || !val || val <= 0) { alert('Preencha todos os campos.'); return }
    setSavingEditExtra(true)
    const { error } = await supabase.from('custos_extras').update({ tipo: editExtraTipo.trim(), valor: val }).eq('id', editExtra.id)
    setSavingEditExtra(false)
    if (error) { alert('Erro: ' + error.message); return }
    setEditExtra(null); load()
  }
  async function deletarCusto(extraId: string) {
    if (!confirm('Remover este custo?')) return
    const { error } = await supabase.from('custos_extras').delete().eq('id', extraId)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  // ── adicionar item ───────────────────────────────────────────────────────
  async function salvarItem() {
    if (!id) return
    if (!itemModelo.trim()) { alert('Informe o modelo.'); return }
    const ref = parseFloat(itemRef.replace(',', '.'))
    if (!ref || ref <= 0) { alert('Informe o valor de mercado.'); return }
    const conserto = itemCondicao === 'defeito' ? (parseFloat(itemConserto.replace(',', '.')) || 0) : 0
    setSavingItem(true)
    const { error } = await supabase.from('itens').insert({
      lote_id: id, modelo: itemModelo.trim(), valor_referencia: ref,
      condicao: itemCondicao, decisao: 'estado', custo_conserto: conserto,
      status: itemStatus, specs: {},
    })
    setSavingItem(false)
    if (error) { alert('Erro: ' + error.message); return }
    setItemModelo(''); setItemRef(''); setItemCondicao('ok'); setItemConserto(''); setItemStatus('avaliar')
    setShowAddItem(false); load()
  }

  // ── excluir lote ─────────────────────────────────────────────────────────
  async function excluirLote() {
    if (!confirm(`Excluir o lote "${lote?.origem}"?\n\nTodos os itens, custos e parcelas serão removidos. Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('lotes').delete().eq('id', id)
    if (error) { alert('Erro ao excluir: ' + error.message); return }
    navigate('/lotes', { replace: true })
  }

  // ── render ───────────────────────────────────────────────────────────────
  if (loading) return <div className="empty-state">Carregando…</div>
  if (erro)    return <div className="empty-state" style={{ color: 'var(--red)' }}>Erro: {erro}</div>
  if (!lote)   return null

  return (
    <>
      <button className="back" onClick={() => navigate('/lotes')}>← Voltar para Lotes</button>

      <div className="detail-head">
        <div>
          <h1>{lote.origem}</h1>
          <div className="meta">
            {lote.data_arremate ? `Arremate ${dtBR(lote.data_arremate)} · ` : ''}
            {lote.data_retirada ? `Retirada ${dtBR(lote.data_retirada)} · ` : ''}
            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn" onClick={abrirEditLote}>Editar lote</button>
          <span className={`badge ${lote.status === 'ativo' ? 'ativo' : 'encerrado'}`}>
            {lote.status === 'ativo' ? 'Ativo' : 'Encerrado'}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="bento c3">
        <Kpi label="Custo total"         value={BRL(custoTotal)}      sub="lote + extras" />
        <Kpi label="Recuperado"          value={BRL(totalVendido)}    sub={`${pct.toFixed(1)}% do custo`} color={breakEven ? 'green' : 'amber'} />
        <Kpi label="Lucro realizado"     value={BRL(lucro)}           sub="itens vendidos" color={lucro > 0 ? 'green' : lucro < 0 ? 'red' : ''} />
      </div>
      <div className="bento c3">
        <Kpi label="Falta p/ break-even" value={breakEven ? '✓ atingido' : BRL(falta)} sub={breakEven ? 'lote no lucro' : 'até zerar'} />
        <Kpi label="Faturamento possível" value={BRL(possibilidade)} sub={`${naoVendidos.length} item${naoVendidos.length !== 1 ? 'ns' : ''} a vender`} color="amber" />
        <Kpi label="Lucro potencial" value={BRL(lucroPotencial)} sub={`${pctLucroPot >= 0 ? '+' : ''}${pctLucroPot.toFixed(1)}% sobre o custo`} color={lucroPotencial > 0 ? 'green' : lucroPotencial < 0 ? 'red' : ''} />
      </div>

      {/* Medidor */}
      <div className="panel meter-big">
        <div className="meter-head">
          <span className="lbl">Quanto do lote você já recuperou</span>
          <span className="pct num" style={{ color: cor }}>{pct.toFixed(1)}%</span>
        </div>
        <div className="meter"><div className="fill" style={{ width: `${pct}%`, background: cor }} /></div>
        <div className="meter-foot">
          {breakEven
            ? 'Lote no lucro. Tudo que vender daqui pra frente é margem líquida.'
            : `Recuperou ${BRL(totalVendido)} de ${BRL(custoTotal)}. Faltam ${BRL(falta)} para zerar.`}
        </div>
      </div>

      {/* Custos */}
      <div className="panel">
        <div className="panel-head">
          <h2>Custos do lote</h2>
          <button className="btn" onClick={() => setShowAddCusto(true)}>+ Adicionar custo</button>
        </div>
        <div className="panel-body">
          <div className="cost-row">
            <span className="lbl">Valor do lote (arremate)</span>
            <span className="num">{BRL(Number(lote.valor_lote))}</span>
          </div>
          {extras.map(e => (
            <div key={e.id} className="cost-row">
              <span className="lbl">{e.tipo}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="num">{BRL(Number(e.valor))}</span>
                <button style={iconBtn} title="Editar" onClick={() => abrirEditExtra(e)}>✏</button>
                <button style={{ ...iconBtn, color: 'var(--red)' }} title="Remover" onClick={() => deletarCusto(e.id)}>×</button>
              </span>
            </div>
          ))}
          <div className="cost-row total">
            <span>Custo total do lote</span>
            <span className="num">{BRL(custoTotal)}</span>
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2>Itens</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['todos','avaliar','estoque','vendido'] as Filtro[]).map(f => (
                <button key={f} onClick={() => setFiltro(f)} style={{
                  padding: '3px 10px', fontSize: 12, fontWeight: 600,
                  border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer',
                  background: filtro === f ? 'var(--ink)' : 'var(--surface)',
                  color:      filtro === f ? '#fff' : 'var(--mut)',
                }}>
                  {f === 'todos' ? 'Todos' : f === 'avaliar' ? 'A avaliar' : f === 'estoque' ? 'Estoque' : 'Vendidos'}
                  {' '}<span style={{ opacity: 0.7 }}>({counts[f]})</span>
                </button>
              ))}
            </div>
          </div>
          <button className="btn" onClick={() => setShowAddItem(true)}>+ Adicionar item</button>
        </div>
        <div style={{ padding: 0 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Modelo</th><th>Condição</th>
                  <th className="right">Custo unit.</th><th className="right">Sugestão / Venda</th>
                  <th>Status</th><th>Estoque</th><th></th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--mut)' }}>Nenhum item.</td></tr>
                )}
                {itensFiltrados.map(it => {
                  const dias   = it.dias_em_estoque ?? 0
                  const parado = it.status === 'estoque' && dias > 30
                  const alarme = it.preco_sugerido < it.custo_total_unitario
                  const badgeCls = it.status === 'vendido' ? 'vendido' : it.status === 'avaliar' ? 'avaliar' : 'estoque'
                  const badgeTxt = it.status === 'vendido' ? 'Vendido' : it.status === 'avaliar' ? 'Avaliar' : 'Estoque'
                  return (
                    <tr key={it.id} className="click" onClick={() => navigate(`/lotes/${id}/itens/${it.id}`)}>
                      <td className="unit-id">#{String(it.id).slice(-4).toUpperCase()}</td>
                      <td className="model-cell">{it.modelo ?? '—'}</td>
                      <td><span className={`badge ${it.condicao === 'defeito' ? 'defeito' : 'ok'}`}>{it.condicao === 'defeito' ? 'Defeito' : 'OK'}</span></td>
                      <td className="right num">{BRL(it.custo_total_unitario)}</td>
                      <td className="right">
                        {it.status === 'vendido'
                          ? <span className="num" style={{ color: 'var(--green)' }}>{BRL(Number(it.preco_venda))}</span>
                          : <span className="num" style={{ color: alarme ? 'var(--red)' : undefined }}>{BRL(it.preco_sugerido)}</span>
                        }
                      </td>
                      <td><span className={`badge ${badgeCls}`}>{badgeTxt}</span></td>
                      <td>
                        {it.status === 'vendido'  && <span className="age">vendido</span>}
                        {it.status === 'avaliar'  && <span className="age">—</span>}
                        {it.status === 'estoque'  && <span className={`age ${parado ? 'warn' : ''}`}>{dias} dias</span>}
                      </td>
                      <td className="right" onClick={e => e.stopPropagation()}>
                        {(it.status === 'estoque' || it.status === 'avaliar') && (
                          <button
                            className="btn primary"
                            style={{ padding: '5px 10px', fontSize: 12, background: it.status === 'avaliar' ? 'linear-gradient(135deg,#d97706,#b45309)' : undefined, boxShadow: it.status === 'avaliar' ? '0 4px 12px rgba(217,119,6,0.35)' : undefined }}
                            onClick={() => setSaleItem({ id: it.id, modelo: it.modelo, preco_sugerido: it.preco_sugerido, custo_total_unitario: it.custo_total_unitario })}
                          >
                            {it.status === 'avaliar' ? 'Pré-venda' : 'Vender'}
                          </button>
                        )}
                        {it.status === 'vendido' && <span className="chev">›</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modais ── */}
      <SaleModal item={saleItem} onClose={() => setSaleItem(null)} onSuccess={() => { setSaleItem(null); load() }} />

      {/* Editar lote */}
      {showEditLote && (
        <Modal title="Editar lote" sub="Atualize os dados do lote." onClose={() => setShowEditLote(false)}>
          <F label="Origem / descrição">
            <input value={editLoteForm.origem} onChange={e => setEditLoteForm(f => ({ ...f, origem: e.target.value }))} />
          </F>
          <div style={{ display: 'flex', gap: 10, marginBottom: 13 }}>
            <DateField label="Data do arremate" value={editLoteForm.data_arremate} onChange={v => setEditLoteForm(f => ({ ...f, data_arremate: v }))} />
            <DateField label="Data de retirada" value={editLoteForm.data_retirada} onChange={v => setEditLoteForm(f => ({ ...f, data_retirada: v }))} />
          </div>
          <F label="Valor do lance (R$)">
            <input type="number" inputMode="decimal" value={editLoteForm.valor_lote} onChange={e => setEditLoteForm(f => ({ ...f, valor_lote: e.target.value }))} />
          </F>
          <F label="Status">
            <select value={editLoteForm.status} onChange={e => setEditLoteForm(f => ({ ...f, status: e.target.value as 'ativo' | 'encerrado' }))}>
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </F>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowEditLote(false)}>Cancelar</button>
            <button className="btn primary" onClick={salvarEditLote} disabled={savingEditLote}>{savingEditLote ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </Modal>
      )}

      {/* Adicionar custo */}
      {showAddCusto && (
        <Modal title="Adicionar custo extra" sub="Rateado igualmente entre todos os itens do lote." onClose={() => setShowAddCusto(false)}>
          <F label="Tipo"><input placeholder="Ex: Frete, Combustível, Van…" value={custoTipo} onChange={e => setCustoTipo(e.target.value)} /></F>
          <F label="Valor (R$)"><input type="number" inputMode="decimal" placeholder="0,00" value={custoValor} onChange={e => setCustoValor(e.target.value)} /></F>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowAddCusto(false)}>Cancelar</button>
            <button className="btn primary" onClick={salvarCusto} disabled={savingCusto}>{savingCusto ? 'Salvando…' : 'Adicionar'}</button>
          </div>
        </Modal>
      )}

      {/* Editar custo extra */}
      {editExtra && (
        <Modal title="Editar custo" sub={editExtra.tipo} onClose={() => setEditExtra(null)}>
          <F label="Tipo"><input value={editExtraTipo} onChange={e => setEditExtraTipo(e.target.value)} /></F>
          <F label="Valor (R$)"><input type="number" inputMode="decimal" value={editExtraValor} onChange={e => setEditExtraValor(e.target.value)} /></F>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEditExtra(null)}>Cancelar</button>
            <button className="btn primary" onClick={salvarEditExtra} disabled={savingEditExtra}>{savingEditExtra ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </Modal>
      )}

      {/* Adicionar item */}
      {showAddItem && (
        <Modal title="Adicionar item" sub="O valor de mercado é a base para o rateio de custo e sugestão de preço." onClose={() => setShowAddItem(false)}>
          <F label="Modelo / descrição"><input placeholder='Ex: Samsung 65" Crystal UHD' value={itemModelo} onChange={e => setItemModelo(e.target.value)} /></F>
          <F label="Valor de mercado — referência (R$)"><input type="number" inputMode="decimal" placeholder="0,00" value={itemRef} onChange={e => setItemRef(e.target.value)} /></F>
          <F label="Condição">
            <select value={itemCondicao} onChange={e => setItemCondicao(e.target.value as 'ok' | 'defeito')}>
              <option value="ok">OK — sem defeito</option>
              <option value="defeito">Defeito</option>
            </select>
          </F>
          {itemCondicao === 'defeito' && (
            <F label="Custo estimado do conserto (R$)"><input type="number" inputMode="decimal" placeholder="0,00" value={itemConserto} onChange={e => setItemConserto(e.target.value)} /></F>
          )}
          <F label="Status inicial">
            <select value={itemStatus} onChange={e => setItemStatus(e.target.value as 'avaliar' | 'estoque')}>
              <option value="avaliar">Avaliar — ainda não recebi / não avaliado</option>
              <option value="estoque">Em estoque — já recebi e conferi</option>
            </select>
          </F>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowAddItem(false)}>Cancelar</button>
            <button className="btn primary" onClick={salvarItem} disabled={savingItem}>{savingItem ? 'Salvando…' : 'Adicionar item'}</button>
          </div>
        </Modal>
      )}

      {/* danger zone */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <button onClick={excluirLote} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '7px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Excluir lote
        </button>
      </div>
    </>
  )
}

// ── sub-componentes locais ───────────────────────────────────────────────────
function Kpi({ label, value, sub, color = '' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kpi">
      <div className="k">{label}</div>
      <div className={`v num ${color}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function Modal({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {sub && <p className="msub">{sub}</p>}
        {children}
      </div>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, background: '#fff', color: 'var(--ink)', outline: 'none' }} />
    </div>
  )
}
