import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BRL, dtBR } from '../lib/calc'
import type { ResumoLote } from '../types'

interface LoteCard extends ResumoLote {
  data_arremate: string | null
  data_retirada: string | null
  cond_total: number
  cond_defeito: number
}

interface NovoForm {
  origem: string
  data_arremate: string
  data_retirada: string
  valor_lote: string
}

const FORM_VAZIO: NovoForm = { origem: '', data_arremate: '', data_retirada: '', valor_lote: '' }

export default function Lotes() {
  const navigate = useNavigate()
  const [lotes, setLotes] = useState<LoteCard[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<NovoForm>(FORM_VAZIO)
  const [saving, setSaving] = useState(false)
  const origemRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    setErro(null)
    try {
      const [resumosRes, lotesRes, itensRes] = await Promise.all([
        supabase.from('resumo_lotes').select('*'),
        supabase.from('lotes').select('id, data_arremate, data_retirada').order('created_at', { ascending: false }),
        supabase.from('itens').select('lote_id, condicao, status'),
      ])
      if (resumosRes.error) throw resumosRes.error
      if (lotesRes.error)  throw lotesRes.error
      if (itensRes.error)  throw itensRes.error

      const datesById = new Map(
        (lotesRes.data ?? []).map(l => [l.id, l]),
      )

      // conta condicao só dos itens JÁ avaliados (status != avaliar) por lote
      const condById = new Map<string, { total: number; defeito: number }>()
      for (const it of (itensRes.data ?? []) as { lote_id: string; condicao: string; status: string }[]) {
        if (it.status === 'avaliar') continue
        const c = condById.get(it.lote_id) ?? { total: 0, defeito: 0 }
        c.total += 1
        if (it.condicao === 'defeito') c.defeito += 1
        condById.set(it.lote_id, c)
      }

      // preserva a ordem de criacao dos lotes
      const ordenado = (lotesRes.data ?? [])
        .map(l => resumosRes.data?.find(r => r.id === l.id))
        .filter(Boolean) as ResumoLote[]

      setLotes(ordenado.map(r => ({
        ...r,
        data_arremate: datesById.get(r.id)?.data_arremate ?? null,
        data_retirada: datesById.get(r.id)?.data_retirada ?? null,
        cond_total:   condById.get(r.id)?.total ?? 0,
        cond_defeito: condById.get(r.id)?.defeito ?? 0,
      })))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar lotes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function abrirModal() {
    setForm(FORM_VAZIO)
    setShowModal(true)
    setTimeout(() => origemRef.current?.focus(), 50)
  }

  function fecharModal() { setShowModal(false) }

  function set(k: keyof NovoForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }

  async function salvar() {
    if (!form.origem.trim()) { alert('Informe a origem do lote.'); return }
    const valor = parseFloat(form.valor_lote.replace(',', '.'))
    if (!valor || valor <= 0) { alert('Informe um valor de lance valido.'); return }

    setSaving(true)
    const { error } = await supabase.from('lotes').insert({
      origem:        form.origem.trim(),
      data_arremate: form.data_arremate || null,
      data_retirada: form.data_retirada || null,
      valor_lote:    valor,
      status:        'ativo',
    })
    setSaving(false)

    if (error) { alert('Erro ao salvar: ' + error.message); return }
    fecharModal()
    load()
  }

  if (loading) return <div className="empty-state">Carregando...</div>
  if (erro)    return <div className="empty-state" style={{ color: 'var(--red)' }}>Erro: {erro}</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Lotes</h1>
          <p>Cada lote e uma compra. Clique para abrir.</p>
        </div>
        <button className="btn primary" onClick={abrirModal}>+ Novo lote</button>
      </div>

      {lotes.length === 0 && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          Nenhum lote cadastrado.{' '}
          <button className="btn primary" style={{ marginLeft: 8 }} onClick={abrirModal}>
            + Novo lote
          </button>
        </div>
      )}

      {lotes.map(l => {
        const pct = l.custo_total_lote > 0
          ? Math.min(100, (l.total_vendido / l.custo_total_lote) * 100)
          : 0
        const cor = l.break_even_atingido ? 'var(--green)' : 'var(--amber)'

        return (
          <div key={l.id} className="lote-card" onClick={() => navigate(`/lotes/${l.id}`)}>
            <div className="lc-top">
              <div>
                <div className="lc-title">{l.origem}</div>
                <div className="lc-sub">
                  {l.qtd_itens} {l.qtd_itens === 1 ? 'item' : 'itens'}
                  {l.data_retirada ? ` · retirado em ${dtBR(l.data_retirada)}` : ''}
                </div>
              </div>
              <span className={`badge ${l.status === 'ativo' ? 'ativo' : 'encerrado'}`}>
                {l.status === 'ativo' ? 'Ativo' : 'Encerrado'}
              </span>
            </div>

            <div className="lc-stats">
              <div className="stat">
                <div className="k">Custo total</div>
                <div className="v num">{BRL(l.custo_total_lote)}</div>
              </div>
              <div className="stat">
                <div className="k">Vendidos</div>
                <div className="v num">{l.qtd_vendidos} / {l.qtd_itens}</div>
              </div>
              <div className="stat">
                <div className="k">Recuperado</div>
                <div className="v num">{BRL(l.total_vendido)}</div>
              </div>
            </div>

            {(() => {
              if (l.cond_total === 0) return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12.5 }}>
                  <span style={{ color: 'var(--mut)', fontWeight: 600 }}>Estado dos produtos</span>
                  <span style={{ color: 'var(--mut)', fontWeight: 700 }}>não avaliado</span>
                </div>
              )
              const bom = l.cond_total - l.cond_defeito
              const pb  = bom / l.cond_total * 100
              const cb  = pb >= 70 ? 'var(--green)' : pb >= 40 ? 'var(--amber)' : 'var(--red)'
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 12.5 }}>
                  <span style={{ color: 'var(--mut)', fontWeight: 600 }}>Estado dos avaliados</span>
                  <span className="num" style={{ color: cb, fontWeight: 700 }}>{pb.toFixed(0)}% · {bom}/{l.cond_total} íntegros</span>
                </div>
              )
            })()}

            <div className="meter-head">
              <span className="lbl">Progresso ate o break-even</span>
              <span className="pct num" style={{ color: cor }}>{pct.toFixed(1)}%</span>
            </div>
            <div className="meter">
              <div className="fill" style={{ width: `${pct}%`, background: cor }} />
            </div>

            <div className="lc-foot">
              <span className="chev">Abrir lote →</span>
            </div>
          </div>
        )
      })}

      {/* Modal novo lote */}
      <div
        className={`overlay ${showModal ? 'show' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) fecharModal() }}
      >
        <div className="modal" role="dialog" aria-modal="true">
          <h3>Novo lote</h3>
          <p className="msub">
            Registre a compra. Itens e custos extras sao adicionados depois.
          </p>

          <div className="field">
            <label>Origem / descricao</label>
            <input
              ref={origemRef}
              placeholder="Ex: Casas Bahia - Lote 03"
              value={form.origem}
              onChange={set('origem')}
              onKeyDown={e => e.key === 'Enter' && salvar()}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 13 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>
                Data do arremate
              </label>
              <input
                className="field input"
                type="date"
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, background: '#fff', color: 'var(--ink)', outline: 'none' }}
                value={form.data_arremate}
                onChange={set('data_arremate')}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>
                Data de retirada
              </label>
              <input
                type="date"
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, background: '#fff', color: 'var(--ink)', outline: 'none' }}
                value={form.data_retirada}
                onChange={set('data_retirada')}
              />
            </div>
          </div>

          <div className="field">
            <label>Valor do lance (R$)</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor_lote}
              onChange={set('valor_lote')}
              onKeyDown={e => e.key === 'Enter' && salvar()}
            />
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={fecharModal}>Cancelar</button>
            <button className="btn primary" onClick={salvar} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar lote'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
