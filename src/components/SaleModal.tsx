import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BRL } from '../lib/calc'

export interface SaleItem {
  id: string
  modelo: string | null
  preco_sugerido: number
  custo_total_unitario: number
}

interface Props {
  item: SaleItem | null
  onClose: () => void
  onSuccess: () => void
}

export default function SaleModal({ item, onClose, onSuccess }: Props) {
  const [cli, setCli]       = useState('')
  const [tel, setTel]       = useState('')
  const [preco, setPreco]   = useState('')
  const [pgto, setPgto]     = useState<'avista' | 'parcelado'>('avista')
  const [nPar, setNPar]     = useState('2')
  const [saving, setSaving] = useState(false)
  const cliRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (item) {
      setCli(''); setTel('')
      setPreco(String(Math.round(item.preco_sugerido)))
      setPgto('avista'); setNPar('2')
      setTimeout(() => cliRef.current?.focus(), 50)
    }
  }, [item])

  async function confirmar() {
    if (!item) return
    if (!cli.trim()) { alert('Informe o nome do cliente.'); return }
    const valor = parseFloat(preco.replace(',', '.'))
    if (!valor || valor <= 0) { alert('Informe um preço de venda válido.'); return }

    setSaving(true)
    const hoje = new Date().toISOString().slice(0, 10)

    const { error: errItem } = await supabase.from('itens').update({
      status: 'vendido',
      preco_venda: valor,
      cliente_nome: cli.trim(),
      cliente_contato: tel.trim() || null,
      data_venda: hoje,
    }).eq('id', item.id)

    if (errItem) { alert('Erro: ' + errItem.message); setSaving(false); return }

    const np   = pgto === 'parcelado' ? parseInt(nPar) : 1
    const base = Math.floor(valor / np * 100) / 100
    const parcelas = Array.from({ length: np }, (_, k) => {
      const d = new Date(); d.setMonth(d.getMonth() + k)
      return {
        item_id:    item.id,
        numero:     k + 1,
        valor:      k === np - 1 ? +(valor - base * (np - 1)).toFixed(2) : base,
        vencimento: d.toISOString().slice(0, 10),
        pago:       pgto === 'avista',
      }
    })

    const { error: errPar } = await supabase.from('parcelas').insert(parcelas)
    if (errPar) alert('Venda salva, mas erro nas parcelas: ' + errPar.message)

    setSaving(false)
    onSuccess()
  }

  if (!item) return null

  return (
    <div className="overlay show" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h3>Registrar venda</h3>
        <p className="msub">
          {item.modelo} · sugestão {BRL(item.preco_sugerido)} · custo {BRL(item.custo_total_unitario)}
        </p>
        <div className="field">
          <label>Cliente</label>
          <input ref={cliRef} placeholder="Nome do comprador" value={cli} onChange={e => setCli(e.target.value)} />
        </div>
        <div className="field">
          <label>Contato (telefone)</label>
          <input placeholder="(17) 9..." value={tel} onChange={e => setTel(e.target.value)} />
        </div>
        <div className="field">
          <label>Preço de venda (R$)</label>
          <input type="number" inputMode="decimal" value={preco} onChange={e => setPreco(e.target.value)} />
        </div>
        <div className="field">
          <label>Forma de pagamento</label>
          <select value={pgto} onChange={e => setPgto(e.target.value as 'avista' | 'parcelado')}>
            <option value="avista">À vista (Pix / dinheiro / cartão)</option>
            <option value="parcelado">Parcelado</option>
          </select>
        </div>
        {pgto === 'parcelado' && (
          <div className="field">
            <label>Número de parcelas</label>
            <select value={nPar} onChange={e => setNPar(e.target.value)}>
              {['2','3','4','6','10','12'].map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={confirmar} disabled={saving}>
            {saving ? 'Salvando…' : 'Registrar venda'}
          </button>
        </div>
      </div>
    </div>
  )
}
