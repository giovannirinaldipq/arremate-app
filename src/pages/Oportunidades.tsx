import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BRL, dtBR } from '../lib/calc'
import type { ResumoOportunidade } from '../types'

type StatusFiltro = 'todos' | 'avaliando' | 'lance_dado' | 'arrematado' | 'perdido'

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

interface NovaForm {
  descricao: string
  origem: string
  data_fechamento: string
  valor_lance_estimado: string
  custo_extras_estimado: string
  observacoes: string
}
const FORM_VAZIO: NovaForm = {
  descricao: '', origem: '', data_fechamento: '',
  valor_lance_estimado: '', custo_extras_estimado: '', observacoes: '',
}

export default function Oportunidades() {
  const navigate = useNavigate()
  const [lista,    setLista]    = useState<ResumoOportunidade[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string | null>(null)
  const [filtro,   setFiltro]   = useState<StatusFiltro>('todos')
  const [showModal, setShowModal] = useState(false)
  const [form,     setForm]     = useState<NovaForm>(FORM_VAZIO)
  const [saving,   setSaving]   = useState(false)
  const descRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true); setErro(null)
    try {
      const { data, error } = await supabase
        .from('resumo_oportunidades')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setLista((data ?? []) as ResumoOportunidade[])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function abrirModal() {
    setForm(FORM_VAZIO)
    setShowModal(true)
    setTimeout(() => descRef.current?.focus(), 50)
  }

  async function salvar() {
    if (!form.descricao.trim()) { alert('Informe a descrição.'); return }
    setSaving(true)
    const { error } = await supabase.from('oportunidades').insert({
      descricao:             form.descricao.trim(),
      origem:                form.origem.trim() || null,
      data_fechamento:       form.data_fechamento || null,
      valor_lance_estimado:  parseFloat(form.valor_lance_estimado.replace(',', '.')) || null,
      custo_extras_estimado: parseFloat(form.custo_extras_estimado.replace(',', '.')) || 0,
      observacoes:           form.observacoes.trim() || null,
    })
    setSaving(false)
    if (error) { alert('Erro: ' + error.message); return }
    setShowModal(false)
    load()
  }

  const exibir = filtro === 'todos' ? lista : lista.filter(o => o.status === filtro)
  const counts: Record<StatusFiltro, number> = {
    todos:      lista.length,
    avaliando:  lista.filter(o => o.status === 'avaliando').length,
    lance_dado: lista.filter(o => o.status === 'lance_dado').length,
    arrematado: lista.filter(o => o.status === 'arrematado').length,
    perdido:    lista.filter(o => o.status === 'perdido').length,
  }

  if (loading) return <div className="empty-state">Carregando…</div>
  if (erro)    return <div className="empty-state" style={{ color: 'var(--red)' }}>Erro: {erro}</div>

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Oportunidades</h1>
          <p>Avalie lotes antes de arrematar. Calcule ROI e acompanhe lances.</p>
        </div>
        <button className="btn primary" onClick={abrirModal}>+ Nova oportunidade</button>
      </div>

      {/* filtros de status */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {(['todos','avaliando','lance_dado','arrematado','perdido'] as StatusFiltro[]).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '5px 13px', fontSize: 12.5, fontWeight: 600,
            border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
            background: filtro === f ? 'var(--ink)' : 'var(--surface)',
            color:      filtro === f ? '#fff' : 'var(--mut)',
            fontFamily: 'inherit',
          }}>
            {f === 'todos' ? 'Todas' : STATUS_LABEL[f]}
            {' '}<span style={{ opacity: 0.65 }}>({counts[f]})</span>
          </button>
        ))}
      </div>

      {exibir.length === 0 && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          {filtro === 'todos'
            ? <>Nenhuma oportunidade cadastrada. <button className="btn primary" style={{ marginLeft: 8 }} onClick={abrirModal}>+ Nova</button></>
            : 'Nenhuma oportunidade com esse status.'
          }
        </div>
      )}

      {exibir.map(o => {
        const roi = o.custo_estimado > 0 ? (o.lucro_estimado / o.custo_estimado * 100) : 0
        const roiColor = roi >= 20 ? 'var(--green)' : roi >= 0 ? 'var(--amber)' : 'var(--red)'
        const lance = o.valor_lance_dado ?? o.valor_lance_estimado
        const fechando = o.data_fechamento ? new Date(o.data_fechamento) : null
        const passou   = fechando && fechando < new Date()

        return (
          <div key={o.id} className="lote-card" onClick={() => navigate(`/oportunidades/${o.id}`)}>
            <div className="lc-top">
              <div>
                <div className="lc-title">{o.descricao}</div>
                <div className="lc-sub">
                  {o.origem ? `${o.origem} · ` : ''}
                  {o.qtd_itens} {o.qtd_itens === 1 ? 'item' : 'itens'}
                  {fechando && (
                    <span style={{ color: passou ? 'var(--red)' : 'var(--amber)', fontWeight: 600 }}>
                      {' · '}{passou ? 'Fechado' : 'Fecha'} {dtBR(o.data_fechamento!.slice(0, 10))}
                    </span>
                  )}
                </div>
              </div>
              <span className={`badge ${STATUS_CLS[o.status]}`}>{STATUS_LABEL[o.status]}</span>
            </div>

            <div className="lc-stats">
              <div className="stat">
                <div className="k">{o.valor_lance_dado ? 'Lance dado' : 'Lance estimado'}</div>
                <div className="v num">{lance ? BRL(lance) : '—'}</div>
              </div>
              <div className="stat">
                <div className="k">Receita possível</div>
                <div className="v num">{o.qtd_itens > 0 ? BRL(o.receita_sugerida) : '—'}</div>
              </div>
              <div className="stat">
                <div className="k">ROI estimado</div>
                <div className="v num" style={{ color: o.qtd_itens > 0 && lance ? roiColor : 'var(--mut)' }}>
                  {o.qtd_itens > 0 && lance ? `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>

            <div className="lc-foot">
              <span className="chev">Abrir →</span>
            </div>
          </div>
        )
      })}

      {/* Modal nova oportunidade */}
      <div className={`overlay ${showModal ? 'show' : ''}`} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
        <div className="modal" role="dialog" aria-modal="true">
          <h3>Nova oportunidade</h3>
          <p className="msub">Cadastre um lote que está avaliando. Adicione os itens depois para calcular o ROI.</p>

          <div className="field">
            <label>Descrição do lote</label>
            <input ref={descRef} placeholder='Ex: Lote TVs Samsung — Leilão BNDES' value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="field">
            <label>Origem / leiloeiro</label>
            <input placeholder='Ex: Lance Certo, Superbid…' value={form.origem}
              onChange={e => setForm(f => ({ ...f, origem: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 13 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Fechamento do leilão</label>
              <input type="datetime-local" value={form.data_fechamento}
                onChange={e => setForm(f => ({ ...f, data_fechamento: e.target.value }))}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, background: '#fff', color: 'var(--ink)', outline: 'none' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 5 }}>Lance estimado (R$)</label>
              <input type="number" inputMode="decimal" placeholder="0,00" value={form.valor_lance_estimado}
                onChange={e => setForm(f => ({ ...f, valor_lance_estimado: e.target.value }))}
                style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 9, background: '#fff', color: 'var(--ink)', outline: 'none' }} />
            </div>
          </div>
          <div className="field">
            <label>Custo extras estimado (frete, etc.) R$</label>
            <input type="number" inputMode="decimal" placeholder="0,00" value={form.custo_extras_estimado}
              onChange={e => setForm(f => ({ ...f, custo_extras_estimado: e.target.value }))} />
          </div>
          <div className="field">
            <label>Observações</label>
            <input placeholder="Notas sobre o lote…" value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && salvar()} />
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Criar oportunidade'}</button>
          </div>
        </div>
      </div>
    </>
  )
}
