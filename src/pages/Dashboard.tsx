import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BRL } from '../lib/calc'

interface DashData {
  investido: number
  recuperado: number
  lucro: number
  qtdLotes: number
  emEstoque: number
  qtdVendidos: number
  qtdTotal: number
  aReceber: number
  vencido: number
  maisAntigo: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setErro(null)
      try {
        const [resumosRes, contasRes, itensEstoqueRes] = await Promise.all([
          supabase.from('resumo_lotes').select(
            'custo_total_lote, total_vendido, lucro_acumulado, qtd_itens, qtd_vendidos',
          ),
          supabase.from('contas_a_receber').select('valor, vencida'),
          supabase
            .from('itens_calculados')
            .select('dias_em_estoque')
            .eq('status', 'estoque'),
        ])

        if (resumosRes.error) throw resumosRes.error
        if (contasRes.error)  throw contasRes.error

        const resumos = resumosRes.data ?? []
        const contas  = contasRes.data ?? []
        const itens   = itensEstoqueRes.data ?? []

        const qtdTotal    = resumos.reduce((s, r) => s + (r.qtd_itens    ?? 0), 0)
        const qtdVendidos = resumos.reduce((s, r) => s + (r.qtd_vendidos ?? 0), 0)

        setData({
          investido:   resumos.reduce((s, r) => s + Number(r.custo_total_lote  ?? 0), 0),
          recuperado:  resumos.reduce((s, r) => s + Number(r.total_vendido     ?? 0), 0),
          lucro:       resumos.reduce((s, r) => s + Number(r.lucro_acumulado   ?? 0), 0),
          qtdLotes:    resumos.length,
          qtdTotal,
          qtdVendidos,
          emEstoque:   qtdTotal - qtdVendidos,
          aReceber:    contas.reduce((s, c) => s + Number(c.valor ?? 0), 0),
          vencido:     contas.filter(c => c.vencida).reduce((s, c) => s + Number(c.valor ?? 0), 0),
          maisAntigo:  itens.reduce((mx, i) => Math.max(mx, i.dias_em_estoque ?? 0), 0),
        })
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="empty-state">Carregando…</div>
  if (erro)    return <div className="empty-state" style={{ color: 'var(--red)' }}>Erro: {erro}</div>
  if (!data)   return null

  const pctRecup = data.investido > 0
    ? (data.recuperado / data.investido * 100).toFixed(0)
    : '0'

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard geral</h1>
          <p>Visão consolidada de todos os lotes.</p>
        </div>
        <button className="btn primary" onClick={() => navigate('/lotes')}>
          Ver lotes →
        </button>
      </div>

      {data.vencido > 0 && (
        <div className="alert-strip">
          ⚠️
          <span>
            Você tem <strong>{BRL(data.vencido)}</strong> em parcelas{' '}
            <strong>vencidas</strong> e não recebidas.
          </span>
          <button
            onClick={() => navigate('/contas')}
            style={{
              marginLeft: 'auto',
              color: 'var(--red)',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontSize: 13.5,
            }}
          >
            Ver contas →
          </button>
        </div>
      )}

      <div className="bento c4">
        <KpiCard
          label="Total investido"
          value={BRL(data.investido)}
          sub={`${data.qtdLotes} lote${data.qtdLotes !== 1 ? 's' : ''}`}
        />
        <KpiCard
          label="Total recuperado"
          value={BRL(data.recuperado)}
          sub={`${pctRecup}% do investido`}
          color="amber"
        />
        <KpiCard
          label="Lucro realizado"
          value={BRL(data.lucro)}
          sub="itens já vendidos"
          color={data.lucro > 0 ? 'green' : data.lucro < 0 ? 'red' : ''}
        />
        <KpiCard
          label="A receber"
          value={BRL(data.aReceber)}
          sub={data.vencido > 0 ? `${BRL(data.vencido)} vencido` : 'em dia'}
          color={data.vencido > 0 ? 'red' : ''}
        />
      </div>

      <div className="bento c3">
        <KpiCard
          label="Itens em estoque"
          value={String(data.emEstoque)}
          sub={`de ${data.qtdTotal} no total`}
        />
        <KpiCard
          label="Itens vendidos"
          value={String(data.qtdVendidos)}
          sub={data.qtdTotal > 0 ? `${(data.qtdVendidos / data.qtdTotal * 100).toFixed(0)}% do total` : ''}
        />
        <KpiCard
          label="Mais tempo parado"
          value={`${data.maisAntigo} dias`}
          sub={data.maisAntigo > 30 ? 'atenção: girar' : data.maisAntigo > 0 ? 'saudável' : '—'}
          color={data.maisAntigo > 30 ? 'amber' : ''}
        />
      </div>

      {data.qtdLotes === 0 && (
        <div className="empty-state" style={{ marginTop: 24 }}>
          Nenhum lote cadastrado ainda.{' '}
          <button
            className="btn primary"
            style={{ marginLeft: 8 }}
            onClick={() => navigate('/lotes')}
          >
            Criar primeiro lote
          </button>
        </div>
      )}
    </>
  )
}

function KpiCard({
  label,
  value,
  sub,
  color = '',
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="kpi">
      <div className="k">{label}</div>
      <div className={`v num ${color}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}
