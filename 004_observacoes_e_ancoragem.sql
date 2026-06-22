-- =====================================================================
-- Migration 004 (corrigida) — Observações por item + ancoragem 75%
-- Nota: como a coluna observacoes entra no i.* da view, a posição das
-- colunas muda; por isso é preciso DROPAR e recriar (create or replace
-- não permite inserir coluna no meio). resumo_lotes depende de
-- itens_calculados, então também é recriada.
-- =====================================================================

alter table public.itens add column if not exists observacoes text;

drop view if exists public.resumo_lotes;
drop view if exists public.itens_calculados;

create view public.itens_calculados as
with
extras_por_lote as (
    select lote_id, sum(valor) as total_extras
    from public.custos_extras group by lote_id
),
ref_por_lote as (
    select lote_id, sum(coalesce(valor_referencia,0)) as soma_ref, count(*) as qtd_itens
    from public.itens group by lote_id
)
select
    i.*,
    round(coalesce(i.valor_referencia,0) / nullif(r.soma_ref,0) * l.valor_lote, 2)      as custo_lote_rateado,
    round(coalesce(e.total_extras,0) / nullif(r.qtd_itens,0), 2)                         as custo_extra_rateado,
    round(
        coalesce(i.valor_referencia,0) / nullif(r.soma_ref,0) * l.valor_lote
        + coalesce(e.total_extras,0) / nullif(r.qtd_itens,0)
        + case when i.condicao='defeito' and i.decisao='consertar' then i.custo_conserto else 0 end
    , 2)                                                                                 as custo_total_unitario,
    round(i.valor_referencia * case when i.condicao='defeito' and i.decisao='estado' then 0.55 else 0.75 end, 2)
                                                                                           as preco_sugerido,
    case when i.preco_venda is not null then
        round(i.preco_venda - (
            coalesce(i.valor_referencia,0) / nullif(r.soma_ref,0) * l.valor_lote
            + coalesce(e.total_extras,0) / nullif(r.qtd_itens,0)
            + case when i.condicao='defeito' and i.decisao='consertar' then i.custo_conserto else 0 end
        ), 2)
    else null end                                                                        as lucro_item,
    case when i.status <> 'vendido'
         then current_date - l.data_retirada
         else i.data_venda - l.data_retirada end                                         as dias_em_estoque
from public.itens i
join public.lotes l on l.id = i.lote_id
join ref_por_lote r on r.lote_id = i.lote_id
left join extras_por_lote e on e.lote_id = i.lote_id;

create view public.resumo_lotes as
select
    l.id, l.origem, l.status, l.valor_lote,
    coalesce(ex.total_extras,0)                      as total_extras,
    l.valor_lote + coalesce(ex.total_extras,0)       as custo_total_lote,
    count(i.id)                                      as qtd_itens,
    count(i.id) filter (where i.status='vendido')    as qtd_vendidos,
    coalesce(sum(i.preco_venda) filter (where i.status='vendido'),0)      as total_vendido,
    coalesce(sum(ic.lucro_item) filter (where i.status='vendido'),0)      as lucro_acumulado,
    (coalesce(sum(i.preco_venda) filter (where i.status='vendido'),0)
        >= (l.valor_lote + coalesce(ex.total_extras,0)))                  as break_even_atingido
from public.lotes l
left join public.itens i on i.lote_id = l.id
left join public.itens_calculados ic on ic.id = i.id
left join (select lote_id, sum(valor) total_extras from public.custos_extras group by lote_id) ex on ex.lote_id = l.id
group by l.id, l.origem, l.status, l.valor_lote, ex.total_extras;
