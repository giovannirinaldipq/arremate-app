export const BRL = (v: number): string =>
  'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const dtBR = (s: string | null | undefined): string =>
  s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

export const FATOR_INTEGRO = 0.88  // íntegro ou defeito+consertar
export const FATOR_ESTADO  = 0.55  // defeito + vender no estado

export function precoSugerido(
  valorRef: number,
  condicao: 'ok' | 'defeito',
  decisao: 'estado' | 'consertar',
): number {
  if (condicao === 'defeito' && decisao === 'estado') return valorRef * FATOR_ESTADO
  return valorRef * FATOR_INTEGRO
}

export interface CustoBreakdown {
  loteRateado: number
  extraRateado: number
  conserto: number
  total: number
}

export function custoUnitario(
  valorRef: number,
  somaRef: number,
  valorLote: number,
  totalExtras: number,
  qtdItens: number,
  custoConserto: number,
  condicao: 'ok' | 'defeito',
  decisao: 'estado' | 'consertar',
): CustoBreakdown {
  const loteRateado = somaRef > 0 ? (valorRef / somaRef) * valorLote : 0
  const extraRateado = qtdItens > 0 ? totalExtras / qtdItens : 0
  const conserto = condicao === 'defeito' && decisao === 'consertar' ? custoConserto : 0
  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    loteRateado: r2(loteRateado),
    extraRateado: r2(extraRateado),
    conserto,
    total: r2(loteRateado + extraRateado + conserto),
  }
}

/** Para o comparativo lado a lado no detalhe do item */
export interface Cenario {
  decisao: 'estado' | 'consertar'
  precoSugerido: number
  custoTotal: number
  lucro: number
}

export function comparativoCenarios(
  valorRef: number,
  somaRef: number,
  valorLote: number,
  totalExtras: number,
  qtdItens: number,
  custoConserto: number,
): { estado: Cenario; consertar: Cenario } {
  const base = custoUnitario(valorRef, somaRef, valorLote, totalExtras, qtdItens, 0, 'defeito', 'estado')
  const baseComConserto = custoUnitario(valorRef, somaRef, valorLote, totalExtras, qtdItens, custoConserto, 'defeito', 'consertar')
  const precoEstado    = valorRef * FATOR_ESTADO
  const precoConsertar = valorRef * FATOR_INTEGRO
  return {
    estado: {
      decisao: 'estado',
      precoSugerido: Math.round(precoEstado * 100) / 100,
      custoTotal: base.total,
      lucro: Math.round((precoEstado - base.total) * 100) / 100,
    },
    consertar: {
      decisao: 'consertar',
      precoSugerido: Math.round(precoConsertar * 100) / 100,
      custoTotal: baseComConserto.total,
      lucro: Math.round((precoConsertar - baseComConserto.total) * 100) / 100,
    },
  }
}
