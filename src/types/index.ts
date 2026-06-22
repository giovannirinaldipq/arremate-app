export interface Lote {
  id: string
  origem: string
  data_arremate: string | null
  data_retirada: string | null
  valor_lote: number
  status: 'ativo' | 'encerrado'
  socio_responsavel: string | null
  observacoes: string | null
  created_at: string
}

export interface CustoExtra {
  id: string
  lote_id: string
  tipo: string
  valor: number
  created_at: string
}

export interface Item {
  id: string
  lote_id: string
  modelo: string | null
  valor_referencia: number | null
  specs: Record<string, string>
  observacoes: string | null
  condicao: 'ok' | 'defeito'
  descricao_defeito: string | null
  custo_conserto: number
  decisao: 'estado' | 'consertar'
  status: 'avaliar' | 'estoque' | 'vendido'
  preco_venda: number | null
  cliente_nome: string | null
  cliente_contato: string | null
  data_venda: string | null
  created_at: string
}

export interface Parcela {
  id: string
  item_id: string
  numero: number
  valor: number
  vencimento: string
  pago: boolean
  pago_em: string | null
  created_at: string
}

export interface ItemCalculado extends Item {
  custo_lote_rateado: number
  custo_extra_rateado: number
  custo_total_unitario: number
  preco_sugerido: number
  lucro_item: number | null
  dias_em_estoque: number | null
  // colunas herdadas do join com lotes (vêm do SELECT i.*)
  // a view inclui apenas colunas de itens + calculadas; lote_id está incluso
}

export interface ResumoLote {
  id: string
  origem: string
  status: string
  valor_lote: number
  total_extras: number
  custo_total_lote: number
  qtd_itens: number
  qtd_vendidos: number
  total_vendido: number
  lucro_acumulado: number
  break_even_atingido: boolean
  // para exibição: datas da lote (precisamos buscar via join ou segunda query)
  data_arremate?: string | null
  data_retirada?: string | null
}

export interface Oportunidade {
  id: string
  descricao: string
  origem: string | null
  data_fechamento: string | null
  valor_lance_estimado: number | null
  valor_lance_dado: number | null
  custo_extras_estimado: number
  status: 'avaliando' | 'lance_dado' | 'arrematado' | 'perdido'
  observacoes: string | null
  lote_convertido_id: string | null
  created_at: string
}

export interface OportunidadeItem {
  id: string
  oportunidade_id: string
  modelo: string | null
  valor_referencia: number
  condicao: 'ok' | 'defeito'
  created_at: string
}

export interface ResumoOportunidade extends Oportunidade {
  qtd_itens: number
  soma_referencia: number
  receita_sugerida: number
  custo_estimado: number
  lucro_estimado: number
}

export interface ContaReceber {
  id: string
  item_id: string
  modelo: string
  cliente_nome: string
  cliente_contato: string | null
  numero: number
  valor: number
  vencimento: string
  pago: boolean
  vencida: boolean
}
