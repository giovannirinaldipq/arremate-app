import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BRL, dtBR, FATOR_INTEGRO, FATOR_ESTADO } from '../lib/calc'
import type { ItemCalculado, Parcela } from '../types'
import SaleModal, { type SaleItem } from '../components/SaleModal'

interface EditItemForm {
  modelo: string
  valor_referencia: string
  condicao: 'ok' | 'defeito'
  descricao_defeito: string
  custo_conserto: string
  status: 'avaliar' | 'estoque' | 'vendido'
}

export default function ItemDetalhe() {
  const { loteId, itemId } = useParams<{ loteId: string; itemId: string }>()
  const navigate = useNavigate()

  const [item,       setItem]       = useState<ItemCalculado | null>(null)
  const [parcelas,   setParcelas]   = useState<Parcela[]>([])
  const [loteOrigem, setLoteOrigem] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [erro,       setErro]       = useState<string | null>(null)

  // venda
  const [saleItem, setSaleItem] = useState<SaleItem | null>(null)

  // comparativo (defeito)
  const [localConserto, setLocalConserto]   = useState(0)
  const [savingDecisao, setSavingDecisao]   = useState(false)

  // editar item
  const [showEditItem,  setShowEditItem]  = useState(false)
  const [editForm,      setEditForm]      = useState<EditItemForm>({ modelo: '', valor_referencia: '', condicao: 'ok', descricao_defeito: '', custo_conserto: '', status: 'avaliar' })
  const [savingEdit,    setSavingEdit]    = useState(false)

  // editar observações
  const [showObs,   setShowObs]   = useState(false)
  const [obsText,   setObsText]   = useState('')
  const [savingObs, setSavingObs] = useState(false)

  async function load() {
    if (!itemId || !loteId) return
    setLoading(true); setErro(null)
    try {
      const [itemRes, loteRes, parRes] = await Promise.all([
        supabase.from('itens_calculados').select('*').eq('id', itemId).single(),
        supabase.from('lotes').select('origem').eq('id', loteId).single(),
        supabase.from('parcelas').select('*').eq('item_id', itemId).order('numero'),
      ])
      if (itemRes.error) throw itemRes.error
      const it = itemRes.data as ItemCalculado
      setItem(it)
      setLocalConserto(it.custo_conserto ?? 0)
      setLoteOrigem(loteRes.data?.origem ?? '')
      setParcelas(parRes.data ?? [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar item.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [itemId])

  function abrirEditItem() {
    if (!item) return
    setEditForm({
      modelo:            item.modelo ?? '',
      valor_referencia:  String(item.valor_referencia ?? ''),
      condicao:          item.condicao,
      descricao_defeito: item.descricao_defeito ?? '',
      custo_conserto:    String(item.custo_conserto ?? 0),
      status:            item.status as 'avaliar' | 'estoque' | 'vendido',
    })
    setShowEditItem(true)
  }

  async function salvarEditItem() {
    if (!item) return
    const ref = parseFloat(editForm.valor_referencia.replace(',', '.'))
    if (!editForm.modelo.trim()) { alert('Informe o modelo.'); return }
    if (!ref || ref <= 0)        { alert('Informe o valor de mercado.'); return }
    setSavingEdit(true)
    const { error } = await supabase.from('itens').update({
      modelo:            editForm.modelo.trim(),
      valor_referencia:  ref,
      condicao:          editForm.condicao,
      descricao_defeito: editForm.descricao_defeito.trim() || null,
      custo_conserto:    editForm.condicao === 'defeito' ? (parseFloat(editForm.custo_conserto.replace(',', '.')) || 0) : 0,
      status:            editForm.status,
    }).eq('id', item.id)
    setSavingEdit(false)
    if (error) { alert('Erro: ' + error.message); return }
    setShowEditItem(false); load()
  }

  async function adotarCenario(decisao: 'estado' | 'consertar') {
    if (!item) return
    setSavingDecisao(true)
    const { error } = await supabase.from('itens').update({ decisao, custo_conserto: localConserto }).eq('id', item.id)
    setSavingDecisao(false)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  function abrirObs() {
    if (!item) return
    setObsText(item.observacoes ?? '')
    setShowObs(true)
  }
  async function salvarObs() {
    if (!item) return
    setSavingObs(true)
    const { error } = await supabase.from('itens').update({ observacoes: obsText.trim() || null }).eq('id', item.id)
    setSavingObs(false)
    if (error) { alert('Erro: ' + error.message); return }
    setShowObs(false); load()
  }

  async function cancelarPreVenda() {
    if (!item) return
    if (!confirm('Cancelar a pré-venda deste item?')) return
    const { error } = await supabase.from('itens').update({ pre_venda_cliente: null, pre_venda_contato: null, pre_venda_preco: null }).eq('id', item.id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  if (loading) return <div className="empty-state">Carregando…</div>
  if (erro)    return <div className="empty-state" style={{ color: 'var(--red)' }}>Erro: {erro}</div>
  if (!item)   return null

  const isDefeito = item.condicao === 'defeito'
  const isVendido = item.status   === 'vendido'
  const isAvaliar = item.status   === 'avaliar'
  const ref       = Number(item.valor_referencia ?? 0)
  const custoLote  = Number(item.custo_lote_rateado  ?? 0)
  const custoExtra = Number(item.custo_extra_rateado ?? 0)
  const custoUnit  = Number(item.custo_total_unitario ?? 0)
  const sugUnit    = Number(item.preco_sugerido ?? 0)
  const alarme     = sugUnit < custoUnit && !isVendido

  // comparativo local (usa localConserto para recalculo em tempo real)
  const cmpEstado    = { preco: ref * FATOR_ESTADO,   custo: custoLote + custoExtra,                lucro: ref * FATOR_ESTADO   - (custoLote + custoExtra) }
  const cmpConsertar = { preco: ref * FATOR_INTEGRO,  custo: custoLote + custoExtra + localConserto, lucro: ref * FATOR_INTEGRO  - (custoLote + custoExtra + localConserto) }
  const veredito     = cmpConsertar.lucro > cmpEstado.lucro ? 'consertar' : 'estado'
  const decisaoAtual = item.decisao ?? 'estado'

  const pagas         = parcelas.filter(p => p.pago).length
  const totalParcelas = parcelas.length

  const badgeCls = isVendido ? 'vendido' : isAvaliar ? 'avaliar' : 'estoque'
  const badgeTxt = isVendido ? 'Vendido' : isAvaliar ? 'A avaliar' : `Em estoque · ${item.dias_em_estoque ?? 0} dias`

  return (
    <>
      <button className="back" onClick={() => navigate(`/lotes/${loteId}`)}>← Voltar para o lote</button>

      {/* cabeçalho */}
      <div className="detail-head">
        <div>
          <h1>{item.modelo ?? '—'}</h1>
          <div className="meta">#{String(item.id).slice(-6).toUpperCase()} · {loteOrigem}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${isDefeito ? 'defeito' : 'ok'}`}>{isDefeito ? 'Defeito' : 'OK'}</span>
          <span className={`badge ${badgeCls}`}>{badgeTxt}</span>
          <button className="btn" onClick={abrirEditItem}>Editar item</button>
          {!isVendido && (
            <button
              className="btn primary"
              style={isAvaliar ? { background: 'linear-gradient(135deg,#d97706,#b45309)', boxShadow: '0 4px 12px rgba(217,119,6,0.35)', borderColor: 'transparent' } : undefined}
              onClick={() => setSaleItem({ id: item.id, modelo: item.modelo, preco_sugerido: sugUnit, custo_total_unitario: custoUnit, mode: isAvaliar ? 'prevenda' : 'venda', cliente: item.pre_venda_cliente, contato: item.pre_venda_contato, preco: item.pre_venda_preco })}
            >
              {isAvaliar ? 'Pré-venda' : 'Registrar venda'}
            </button>
          )}
        </div>
      </div>

      {isAvaliar && (
        <div style={{ background: 'var(--amber-bg)', border: '1px solid #f0d99a', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 14, fontSize: 13.5, color: '#7a5200' }}>
          ⏳ <strong>Produto em avaliação.</strong> Assim que receber e conferir, edite o item e mude o status para "Em estoque".
        </div>
      )}

      {!isVendido && item.pre_venda_preco != null && (
        <div style={{ background: 'var(--green-bg)', border: '1px solid #6ee7b7', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 14, fontSize: 13.5, color: '#065f46', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>🤝 <strong>Pré-venda registrada:</strong> {item.pre_venda_cliente}{item.pre_venda_contato ? ` · ${item.pre_venda_contato}` : ''} · combinado {BRL(Number(item.pre_venda_preco))}</span>
          <button className="btn" onClick={cancelarPreVenda} style={{ fontSize: 12 }}>Cancelar pré-venda</button>
        </div>
      )}

      <div className="item-grid">
        {/* Observações */}
        <div className="panel">
          <div className="panel-head">
            <h2>Observações</h2>
            <button className="btn" onClick={abrirObs}>Editar</button>
          </div>
          <div className="panel-body">
            {item.observacoes
              ? <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.observacoes}</p>
              : <p style={{ color: 'var(--mut)', fontSize: 13 }}>Nenhuma observação. Clique em Editar para acompanhar este produto.</p>
            }
            {isDefeito && item.descricao_defeito && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--red-bg)', borderRadius: 8, fontSize: 13, color: '#8f2b23' }}>
                <strong>Defeito:</strong> {item.descricao_defeito}
              </div>
            )}
          </div>
        </div>

        {/* Precificação */}
        <div className="panel price-box">
          <div className="panel-head" style={{ margin: '-16px -18px 12px', padding: '14px 18px' }}>
            <h2>Precificação</h2>
          </div>

          {/* composição do custo linha a linha */}
          <div className="price-line">
            <span className="lbl">Valor de mercado (ref.)</span>
            <span className="num">{BRL(ref)}</span>
          </div>
          <div className="price-line" style={{ fontSize: 12 }}>
            <span className="lbl" style={{ color: 'var(--mut)' }}>↳ Rateio do lote (proporcional)</span>
            <span className="num" style={{ color: 'var(--mut)' }}>{BRL(custoLote)}</span>
          </div>
          <div className="price-line" style={{ fontSize: 12 }}>
            <span className="lbl" style={{ color: 'var(--mut)' }}>↳ Extras (rateio igual)</span>
            <span className="num" style={{ color: 'var(--mut)' }}>{BRL(custoExtra)}</span>
          </div>
          {isDefeito && decisaoAtual === 'consertar' && (
            <div className="price-line" style={{ fontSize: 12 }}>
              <span className="lbl" style={{ color: 'var(--mut)' }}>↳ Conserto (custo direto)</span>
              <span className="num" style={{ color: 'var(--mut)' }}>{BRL(Number(item.custo_conserto))}</span>
            </div>
          )}
          <div className="price-line" style={{ borderTop: '1px solid var(--line)', paddingTop: 8, marginTop: 4, fontWeight: 700 }}>
            <span className="lbl">Seu custo nesta unidade</span>
            <span className="num">{BRL(custoUnit)}</span>
          </div>

          {/* item ok */}
          {!isDefeito && (
            <div className={`suggest ${alarme ? 'alarm' : ''}`}>
              <div className="lbl">{alarme ? '⚠ Sugestão abaixo do custo' : 'Preço sugerido'}</div>
              <div className="big num">{BRL(sugUnit)}</div>
              <div className="note">
                {alarme
                  ? 'Você pagou caro nesta unidade. Vender pela sugestão dá prejuízo.'
                  : <>Ancorado em {FATOR_INTEGRO * 100}% do valor de mercado. Margem prevista: <strong>{BRL(sugUnit - custoUnit)}</strong>.</>
                }
              </div>
            </div>
          )}

          {/* comparativo defeito */}
          {isDefeito && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--mut)', marginBottom: 8 }}>
                Comparativo de cenários
              </div>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Custo do conserto (R$) — edite para recalcular</label>
                <input type="number" inputMode="decimal" value={localConserto}
                  onChange={e => setLocalConserto(parseFloat(e.target.value) || 0)}
                  style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 8, outline: 'none' }} />
              </div>
              <div className="compare-grid">
                {[
                  { key: 'estado' as const, label: `No estado (${FATOR_ESTADO * 100}%)`, cmp: cmpEstado },
                  { key: 'consertar' as const, label: `Consertar (${FATOR_INTEGRO * 100}%)`, cmp: cmpConsertar },
                ].map(({ key, label, cmp }) => (
                  <div key={key} className={`compare-card ${veredito === key ? 'winner' : ''}`}>
                    <div className="c-label">{label}</div>
                    <div className="c-price num">{BRL(cmp.preco)}</div>
                    <div className="c-lucro">
                      Custo: {BRL(cmp.custo)}<br />
                      <strong style={{ color: cmp.lucro >= 0 ? 'var(--green)' : 'var(--red)' }}>Lucro: {BRL(cmp.lucro)}</strong>
                    </div>
                    {decisaoAtual !== key
                      ? <button className={`btn ${key === 'consertar' ? 'primary' : ''}`} style={{ marginTop: 8, width: '100%', fontSize: 12 }} onClick={() => adotarCenario(key)} disabled={savingDecisao}>Adotar</button>
                      : <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>✓ Adotado</div>
                    }
                  </div>
                ))}
              </div>
              <div className="veredito">
                {veredito === 'consertar'
                  ? `✓ Consertar é mais lucrativo (${BRL(cmpConsertar.lucro - cmpEstado.lucro)} a mais)`
                  : `✓ Vender no estado é mais lucrativo (${BRL(cmpEstado.lucro - cmpConsertar.lucro)} a mais)`
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Venda realizada */}
      {isVendido && (
        <div className="panel">
          <div className="panel-head"><h2>Venda</h2><span className="badge vendido">Vendido</span></div>
          <div className="panel-body">
            <div className="price-line"><span className="lbl">Cliente</span><span>{item.cliente_nome}</span></div>
            {item.cliente_contato && <div className="price-line"><span className="lbl">Contato</span><span>{item.cliente_contato}</span></div>}
            <div className="price-line"><span className="lbl">Data da venda</span><span>{dtBR(item.data_venda)}</span></div>
            <div className="price-line"><span className="lbl">Preço de venda</span><span className="num">{BRL(Number(item.preco_venda))}</span></div>
            <div className="price-line">
              <span className="lbl">Lucro real</span>
              <span className="num" style={{ color: Number(item.lucro_item) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {BRL(Number(item.lucro_item))}{custoUnit > 0 && <> · {(Number(item.lucro_item) / custoUnit * 100).toFixed(1)}%</>}
              </span>
            </div>
            <div className="price-line">
              <span className="lbl">Pagamento</span>
              <span>{totalParcelas > 1 ? `Parcelado ${pagas}/${totalParcelas}` : 'À vista'}</span>
            </div>
            {totalParcelas > 1 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mut)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Parcelas</div>
                {parcelas.map(p => (
                  <div key={p.id} className="price-line" style={{ fontSize: 13 }}>
                    <span className="lbl">{p.numero}ª parcela · {dtBR(p.vencimento)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="num">{BRL(Number(p.valor))}</span>
                      <span className={`badge ${p.pago ? 'pago' : new Date(p.vencimento + 'T12:00:00') < new Date() ? 'vencido' : 'aberto'}`}>
                        {p.pago ? 'Pago' : new Date(p.vencimento + 'T12:00:00') < new Date() ? 'Vencida' : 'Em aberto'}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal venda */}
      <SaleModal item={saleItem} onClose={() => setSaleItem(null)} onSuccess={() => { setSaleItem(null); load() }} />

      {/* Modal editar item */}
      {showEditItem && (
        <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) setShowEditItem(false) }}>
          <div className="modal" role="dialog" aria-modal="true">
            <h3>Editar item</h3>
            <p className="msub">Altere os dados desta unidade.</p>
            <div className="field">
              <label>Modelo / descrição</label>
              <input value={editForm.modelo} onChange={e => setEditForm(f => ({ ...f, modelo: e.target.value }))} />
            </div>
            <div className="field">
              <label>Valor de mercado — referência (R$)</label>
              <input type="number" inputMode="decimal" value={editForm.valor_referencia} onChange={e => setEditForm(f => ({ ...f, valor_referencia: e.target.value }))} />
            </div>
            <div className="field">
              <label>Condição</label>
              <select value={editForm.condicao} onChange={e => setEditForm(f => ({ ...f, condicao: e.target.value as 'ok' | 'defeito' }))}>
                <option value="ok">OK — sem defeito</option>
                <option value="defeito">Defeito</option>
              </select>
            </div>
            {editForm.condicao === 'defeito' && (
              <>
                <div className="field">
                  <label>Descrição do defeito</label>
                  <input placeholder="Ex: tela trincada, não liga…" value={editForm.descricao_defeito} onChange={e => setEditForm(f => ({ ...f, descricao_defeito: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Custo do conserto (R$)</label>
                  <input type="number" inputMode="decimal" value={editForm.custo_conserto} onChange={e => setEditForm(f => ({ ...f, custo_conserto: e.target.value }))} />
                </div>
              </>
            )}
            <div className="field">
              <label>Status</label>
              <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as 'avaliar' | 'estoque' | 'vendido' }))}>
                <option value="avaliar">A avaliar — ainda não recebi / não avaliado</option>
                <option value="estoque">Em estoque — disponível para venda</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowEditItem(false)}>Cancelar</button>
              <button className="btn primary" onClick={salvarEditItem} disabled={savingEdit}>{savingEdit ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar observações */}
      {showObs && (
        <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) setShowObs(false) }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <h3>Observações</h3>
            <p className="msub">Anote o que for útil para acompanhar este produto: estado, histórico, combinados, etc.</p>
            <textarea value={obsText} onChange={e => setObsText(e.target.value)} rows={8}
              placeholder="Escreva aqui…"
              style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 9, outline: 'none', resize: 'vertical', lineHeight: 1.5 }} />
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowObs(false)}>Cancelar</button>
              <button className="btn primary" onClick={salvarObs} disabled={savingObs}>{savingObs ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
