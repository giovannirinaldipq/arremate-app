import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BRL, dtBR, FATOR_INTEGRO, FATOR_ESTADO } from '../lib/calc'
import type { Oportunidade, OportunidadeItem } from '../types'

const STATUS_LABEL: Record<string, string> = {
  avaliando:  'Avaliando',
  lance_dado: 'Lance dado',
  arrematado: 'Arrematado',
  perdido:    'Perdido',
}
const STATUS_CLS: Record<string, string> = {
  avaliando:  'avaliar',
  lance_dado: 'aberto',
  arrematado: 'ativo',
  perdido:    'encerrado',
}

export default function OportunidadeDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [op,      setOp]      = useState<Oportunidade | null>(null)
  const [itens,   setItens]   = useState<OportunidadeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)

  // editar oportunidade
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ descricao: '', origem: '', data_fechamento: '', valor_lance_estimado: '', custo_extras_estimado: '', observacoes: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // registrar lance
  const [showLance, setShowLance] = useState(false)
  const [lanceValor, setLanceValor] = useState('')
  const [savingLance, setSavingLance] = useState(false)

  // converter para lote
  const [showConverter, setShowConverter] = useState(false)
  const [convForm, setConvForm] = useState({ data_arremate: '', data_retirada: '' })
  const [savingConv, setSavingConv] = useState(false)

  // add item
  const [showAddItem,  setShowAddItem]  = useState(false)
  const [itemModelo,   setItemModelo]   = useState('')
  const [itemRef,      setItemRef]      = useState('')
  const [itemCondicao, setItemCondicao] = useState<'ok' | 'defeito'>('ok')
  const [savingItem,   setSavingItem]   = useState(false)

  async function load() {
    if (!id) return
    setLoading(true); setErro(null)
    try {
      const [opRes, itensRes] = await Promise.all([
        supabase.from('oportunidades').select('*').eq('id', id).single(),
        supabase.from('oportunidade_itens').select('*').eq('oportunidade_id', id).order('created_at'),
      ])
      if (opRes.error) throw opRes.error
      setOp(opRes.data as Oportunidade)
      setItens((itensRes.data ?? []) as OportunidadeItem[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  // ── computed ─────────────────────────────────────────────────────────────
  const somaRef       = itens.reduce((s, i) => s + Number(i.valor_referencia), 0)
  const receitaEstim  = itens.reduce((s, i) => s + Number(i.valor_referencia) * (i.condicao === 'defeito' ? FATOR_ESTADO : FATOR_INTEGRO), 0)
  const lance         = op ? Number(op.valor_lance_dado ?? op.valor_lance_estimado ?? 0) : 0
  const extras        = op ? Number(op.custo_extras_estimado ?? 0) : 0
  const custoEstim    = lance + extras
  const lucroEstim    = receitaEstim - custoEstim
  const roi           = custoEstim > 0 ? (lucroEstim / custoEstim * 100) : 0
  const roiColor      = roi >= 20 ? 'var(--green)' : roi >= 0 ? 'var(--amber)' : 'var(--red)'
  const veredito      = roi >= 20 ? { txt: 'Boa oportunidade', cor: 'var(--green)', bg: 'var(--green-bg)' }
                      : roi >= 0  ? { txt: 'Margem baixa — avalie com cuidado', cor: 'var(--amber)', bg: 'var(--amber-bg)' }
                      :             { txt: 'ROI negativo — evitar', cor: 'var(--red)', bg: 'var(--red-bg)' }

  // ── ações de status ────────────────────────────────────────────────────
  async function mudarStatus(status: string, extra?: Record<string, unknown>) {
    if (!id) return
    const { error } = await supabase.from('oportunidades').update({ status, ...extra }).eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  async function registrarLance() {
    const val = parseFloat(lanceValor.replace(',', '.'))
    if (!val || val <= 0) { alert('Informe o valor do lance.'); return }
    setSavingLance(true)
    await mudarStatus('lance_dado', { valor_lance_dado: val })
    setSavingLance(false)
    setShowLance(false)
    setLanceValor('')
  }

  // ── editar ─────────────────────────────────────────────────────────────
  function abrirEdit() {
    if (!op) return
    setEditForm({
      descricao:             op.descricao,
      origem:                op.origem ?? '',
      data_fechamento:       op.data_fechamento ? op.data_fechamento.slice(0, 16) : '',
      valor_lance_estimado:  op.valor_lance_estimado != null ? String(op.valor_lance_estimado) : '',
      custo_extras_estimado: String(op.custo_extras_estimado ?? 0),
      observacoes:           op.observacoes ?? '',
    })
    setShowEdit(true)
  }
  async function salvarEdit() {
    if (!id || !editForm.descricao.trim()) { alert('Informe a descrição.'); return }
    setSavingEdit(true)
    const { error } = await supabase.from('oportunidades').update({
      descricao:             editForm.descricao.trim(),
      origem:                editForm.origem.trim() || null,
      data_fechamento:       editForm.data_fechamento || null,
      valor_lance_estimado:  parseFloat(editForm.valor_lance_estimado.replace(',', '.')) || null,
      custo_extras_estimado: parseFloat(editForm.custo_extras_estimado.replace(',', '.')) || 0,
      observacoes:           editForm.observacoes.trim() || null,
    }).eq('id', id)
    setSavingEdit(false)
    if (error) { alert('Erro: ' + error.message); return }
    setShowEdit(false); load()
  }

  // ── add item ───────────────────────────────────────────────────────────
  async function salvarItem() {
    if (!id) return
    if (!itemModelo.trim()) { alert('Informe o modelo.'); return }
    const ref = parseFloat(itemRef.replace(',', '.'))
    if (!ref || ref <= 0) { alert('Informe o valor de mercado.'); return }
    setSavingItem(true)
    const { error } = await supabase.from('oportunidade_itens').insert({
      oportunidade_id: id, modelo: itemModelo.trim(),
      valor_referencia: ref, condicao: itemCondicao,
    })
    setSavingItem(false)
    if (error) { alert('Erro: ' + error.message); return }
    setItemModelo(''); setItemRef(''); setItemCondicao('ok')
    setShowAddItem(false); load()
  }

  async function deletarItem(itemId: string) {
    if (!confirm('Remover item?')) return
    const { error } = await supabase.from('oportunidade_itens').delete().eq('id', itemId)
    if (error) { alert('Erro: ' + error.message); return }
    load()
  }

  // ── excluir oportunidade ───────────────────────────────────────────────
  async function excluirOportunidade() {
    if (!confirm('Excluir esta oportunidade? Esta ação não pode ser desfeita.')) return
    const { error } = await supabase.from('oportunidades').delete().eq('id', id)
    if (error) { alert('Erro: ' + error.message); return }
    navigate('/oportunidades', { replace: true })
  }

  // ── converter para lote ───────────────────────────────────────────────
  async function converterParaLote() {
    if (!op) return
    const valorLance = Number(op.valor_lance_dado ?? op.valor_lance_estimado ?? 0)
    if (!valorLance) { alert('Registre o valor do lance antes de converter.'); return }
    setSavingConv(true)
    try {
      const { data: loteData, error: loteErr } = await supabase
        .from('lotes')
        .insert({
          origem:        op.descricao,
          data_arremate: convForm.data_arremate || null,
          data_retirada: convForm.data_retirada || null,
          valor_lote:    valorLance,
          status:        'ativo',
        })
        .select('id')
        .single()
      if (loteErr) throw loteErr

      if (itens.length > 0) {
        const itensMapped = itens.map(i => ({
          lote_id:         loteData.id,
          modelo:          i.modelo,
          valor_referencia: i.valor_referencia,
          condicao:        i.condicao,
          decisao:         'estado',
          custo_conserto:  0,
          status:          'avaliar',
          specs:           {},
        }))
        const { error: itensErr } = await supabase.from('itens').insert(itensMapped)
        if (itensErr) throw itensErr
      }

      await supabase.from('oportunidades').update({
        status: 'arrematado',
        lote_convertido_id: loteData.id,
      }).eq('id', id)

      navigate(`/lotes/${loteData.id}`, { replace: true })
    } catch (e) {
      alert('Erro ao converter: ' + (e instanceof Error ? e.message : e))
    } finally {
      setSavingConv(false)
      setShowConverter(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────
  if (loading) return <div className="empty-state">Carregando…</div>
  if (erro)    return <div className="empty-state" style={{ color: 'var(--red)' }}>Erro: {erro}</div>
  if (!op)     return null

  const fechando = op.data_fechamento ? new Date(op.data_fechamento) : null
  const passou   = fechando && fechando < new Date()

  return (
    <>
      <button className="back" onClick={() => navigate('/oportunidades')}>← Voltar para Oportunidades</button>

      {/* cabeçalho */}
      <div className="detail-head">
        <div>
          <h1>{op.descricao}</h1>
          <div className="meta">
            {op.origem ? `${op.origem} · ` : ''}
            {fechando && (
              <span style={{ color: passou ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>
                {passou ? 'Fechado em ' : 'Fecha em '}{dtBR(op.data_fechamento!.slice(0, 10))}
                {' '}
                {!passou && (() => {
                  const diff = fechando.getTime() - Date.now()
                  const h = Math.floor(diff / 3600000)
                  const d = Math.floor(h / 24)
                  return d > 0 ? `(${d}d)` : h > 0 ? `(${h}h)` : '(em breve)'
                })()}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`badge ${STATUS_CLS[op.status]}`}>{STATUS_LABEL[op.status]}</span>
          <button className="btn" onClick={abrirEdit}>Editar</button>
          {op.status === 'avaliando' && (
            <button className="btn primary" onClick={() => { setLanceValor(String(op.valor_lance_estimado ?? '')); setShowLance(true) }}>
              Registrar lance
            </button>
          )}
          {op.status === 'lance_dado' && (<>
            <button className="btn primary" onClick={() => mudarStatus('arrematado')}>
              Arrematei!
            </button>
            <button className="btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => { if (confirm('Marcar como perdido?')) mudarStatus('perdido') }}>
              Perdi
            </button>
          </>)}
          {op.status === 'arrematado' && !op.lote_convertido_id && (
            <button className="btn primary" onClick={() => setShowConverter(true)}>
              Converter para lote ativo →
            </button>
          )}
          {op.lote_convertido_id && (
            <button className="btn" onClick={() => navigate(`/lotes/${op.lote_convertido_id}`)}>
              Ver lote criado →
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="bento c3">
        <Kpi label={op.valor_lance_dado ? 'Lance dado' : 'Lance estimado'} value={lance ? BRL(lance) : '—'} sub={op.custo_extras_estimado > 0 ? `+ ${BRL(extras)} extras` : 'sem extras'} />
        <Kpi label="Custo total estimado" value={custoEstim > 0 ? BRL(custoEstim) : '—'} sub="lance + extras" />
        <Kpi label="Valor de mercado total" value={somaRef > 0 ? BRL(somaRef) : '—'} sub={`${itens.length} ite${itens.length !== 1 ? 'ns' : 'm'}`} />
      </div>
      <div className="bento c3">
        <Kpi label="Receita sugerida" value={receitaEstim > 0 ? BRL(receitaEstim) : '—'} sub="88% OK · 55% defeito" color="amber" />
        <Kpi label="Lucro estimado" value={custoEstim > 0 && receitaEstim > 0 ? BRL(lucroEstim) : '—'} sub="receita − custo" color={lucroEstim > 0 ? 'green' : lucroEstim < 0 ? 'red' : ''} />
        <Kpi label="ROI estimado" value={custoEstim > 0 && receitaEstim > 0 ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '—'} sub="lucro / custo" color={roi >= 20 ? 'green' : roi >= 0 ? 'amber' : 'red'} />
      </div>

      {/* veredito */}
      {custoEstim > 0 && receitaEstim > 0 && (
        <div style={{ background: veredito.bg, border: `1px solid ${veredito.cor}33`, borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{roi >= 20 ? '✅' : roi >= 0 ? '⚠️' : '🚫'}</span>
          <div>
            <div style={{ fontWeight: 700, color: veredito.cor, fontSize: 14 }}>{veredito.txt}</div>
            <div style={{ fontSize: 12.5, color: 'var(--mut)', marginTop: 2 }}>
              {roi >= 0
                ? `Vendendo tudo pela sugestão, você recupera o investimento e ainda tem ${BRL(lucroEstim)} de margem.`
                : `Vendendo pela sugestão, você ainda ficaria ${BRL(Math.abs(lucroEstim))} no negativo.`
              }
            </div>
          </div>
        </div>
      )}

      {/* Itens */}
      <div className="panel">
        <div className="panel-head">
          <h2>Itens do lote</h2>
          <button className="btn" onClick={() => setShowAddItem(true)}>+ Adicionar item</button>
        </div>
        <div style={{ padding: 0 }}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Condição</th>
                  <th className="right">Valor de mercado</th>
                  <th className="right">Sugestão de venda</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--mut)' }}>
                    Nenhum item ainda. Adicione itens para calcular o ROI.
                  </td></tr>
                )}
                {itens.map(it => {
                  const sug = Number(it.valor_referencia) * (it.condicao === 'defeito' ? FATOR_ESTADO : FATOR_INTEGRO)
                  return (
                    <tr key={it.id}>
                      <td className="model-cell">{it.modelo ?? '—'}</td>
                      <td><span className={`badge ${it.condicao === 'defeito' ? 'defeito' : 'ok'}`}>{it.condicao === 'defeito' ? 'Defeito' : 'OK'}</span></td>
                      <td className="right num">{BRL(Number(it.valor_referencia))}</td>
                      <td className="right num">{BRL(sug)}</td>
                      <td className="right">
                        <button onClick={() => deletarItem(it.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mut)', fontSize: 16, padding: '2px 6px' }} title="Remover">×</button>
                      </td>
                    </tr>
                  )
                })}
                {itens.length > 0 && (
                  <tr style={{ borderTop: '2px solid var(--line)', fontWeight: 700 }}>
                    <td colSpan={2}>Total</td>
                    <td className="right num">{BRL(somaRef)}</td>
                    <td className="right num">{BRL(receitaEstim)}</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Observações */}
      {op.observacoes && (
        <div className="panel">
          <div className="panel-head"><h2>Observações</h2></div>
          <div className="panel-body" style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            {op.observacoes}
          </div>
        </div>
      )}

      {/* danger zone */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <button onClick={excluirOportunidade} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 10, padding: '7px 16px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Excluir oportunidade
        </button>
      </div>

      {/* ── Modais ── */}

      {/* Registrar lance */}
      {showLance && (
        <Modal title="Registrar lance" sub="Informe o valor que você deu no leilão." onClose={() => setShowLance(false)}>
          <div className="field">
            <label>Valor do lance (R$)</label>
            <input type="number" inputMode="decimal" placeholder="0,00" value={lanceValor} autoFocus
              onChange={e => setLanceValor(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && registrarLance()} />
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowLance(false)}>Cancelar</button>
            <button className="btn primary" onClick={registrarLance} disabled={savingLance}>{savingLance ? 'Salvando…' : 'Registrar'}</button>
          </div>
        </Modal>
      )}

      {/* Editar oportunidade */}
      {showEdit && (
        <Modal title="Editar oportunidade" onClose={() => setShowEdit(false)}>
          <div className="field"><label>Descrição</label>
            <input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} /></div>
          <div className="field"><label>Origem / leiloeiro</label>
            <input value={editForm.origem} onChange={e => setEditForm(f => ({ ...f, origem: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 13 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Fechamento</label>
              <input type="datetime-local" value={editForm.data_fechamento} onChange={e => setEditForm(f => ({ ...f, data_fechamento: e.target.value }))}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Lance estimado (R$)</label>
              <input type="number" inputMode="decimal" value={editForm.valor_lance_estimado} onChange={e => setEditForm(f => ({ ...f, valor_lance_estimado: e.target.value }))}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, outline: 'none' }} />
            </div>
          </div>
          <div className="field"><label>Custo extras estimado (R$)</label>
            <input type="number" inputMode="decimal" value={editForm.custo_extras_estimado} onChange={e => setEditForm(f => ({ ...f, custo_extras_estimado: e.target.value }))} /></div>
          <div className="field"><label>Observações</label>
            <input value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowEdit(false)}>Cancelar</button>
            <button className="btn primary" onClick={salvarEdit} disabled={savingEdit}>{savingEdit ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </Modal>
      )}

      {/* Adicionar item */}
      {showAddItem && (
        <Modal title="Adicionar item" sub="O valor de mercado é usado para calcular a receita sugerida e o ROI." onClose={() => setShowAddItem(false)}>
          <div className="field"><label>Modelo / descrição</label>
            <input placeholder='Ex: Samsung 65" Crystal UHD' value={itemModelo} autoFocus onChange={e => setItemModelo(e.target.value)} /></div>
          <div className="field"><label>Valor de mercado (R$)</label>
            <input type="number" inputMode="decimal" placeholder="0,00" value={itemRef} onChange={e => setItemRef(e.target.value)} /></div>
          <div className="field"><label>Condição esperada</label>
            <select value={itemCondicao} onChange={e => setItemCondicao(e.target.value as 'ok' | 'defeito')}>
              <option value="ok">OK — sem defeito</option>
              <option value="defeito">Defeito (estimado)</option>
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowAddItem(false)}>Cancelar</button>
            <button className="btn primary" onClick={salvarItem} disabled={savingItem}>{savingItem ? 'Salvando…' : 'Adicionar'}</button>
          </div>
        </Modal>
      )}

      {/* Converter para lote */}
      {showConverter && (
        <Modal title="Converter para lote ativo" sub="Isso cria um lote real com os itens desta oportunidade." onClose={() => setShowConverter(false)}>
          <div style={{ background: 'var(--green-bg)', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#065f46' }}>
            Lance de <strong>{BRL(Number(op.valor_lance_dado ?? op.valor_lance_estimado ?? 0))}</strong> será usado como valor do lote.
            {itens.length > 0 && <> Os {itens.length} itens serão copiados com status <strong>A avaliar</strong>.</>}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 13 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Data do arremate</label>
              <input type="date" value={convForm.data_arremate} onChange={e => setConvForm(f => ({ ...f, data_arremate: e.target.value }))}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Data de retirada</label>
              <input type="date" value={convForm.data_retirada} onChange={e => setConvForm(f => ({ ...f, data_retirada: e.target.value }))}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, outline: 'none' }} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowConverter(false)}>Cancelar</button>
            <button className="btn primary" onClick={converterParaLote} disabled={savingConv}>{savingConv ? 'Criando lote…' : 'Criar lote ativo'}</button>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── sub-componentes ──────────────────────────────────────────────────────────
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
