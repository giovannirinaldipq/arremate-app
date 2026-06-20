-- =====================================================================
-- Sistema de Gestão de Lotes de Leilão — Migration v2 (Supabase)
-- Reflete o que foi validado no mockup: rateio do lote (proporcional ao
-- valor de mercado) + extras (igual por item) + conserto por unidade +
-- decisão consertar/vender-no-estado + clientes + parcelas.
-- =====================================================================

create table public.lotes (
    id                  uuid primary key default gen_random_uuid(),
    origem              text        not null,
    data_arremate       date,
    data_retirada       date,                              -- usado para "tempo em estoque"
    valor_lote          numeric(12,2) not null,
    status              text        not null default 'ativo',
    socio_responsavel   text,
    observacoes         text,
    created_at          timestamptz not null default now()
);

create table public.custos_extras (
    id          uuid primary key default gen_random_uuid(),
    lote_id     uuid not null references public.lotes(id) on delete cascade,
    tipo        text not null,
    valor       numeric(12,2) not null,
    created_at  timestamptz not null default now()
);
create index idx_custos_extras_lote on public.custos_extras(lote_id);

create table public.itens (
    id                  uuid primary key default gen_random_uuid(),
    lote_id             uuid not null references public.lotes(id) on delete cascade,
    modelo              text,
    valor_referencia    numeric(12,2),          -- valor de mercado: base do rateio E da sugestão de preço
    specs               jsonb default '{}',     -- especificações técnicas livres (polegadas, resolução, etc.)
    condicao            text not null default 'ok',   -- ok / defeito
    descricao_defeito   text,
    custo_conserto      numeric(12,2) not null default 0,
    decisao             text not null default 'estado', -- 'estado' (vender no estado) | 'consertar'  — só relevante se condicao='defeito'
    status              text not null default 'estoque', -- estoque / vendido
    preco_venda         numeric(12,2),
    cliente_nome        text,
    cliente_contato     text,
    data_venda          date,
    created_at          timestamptz not null default now()
);
create index idx_itens_lote on public.itens(lote_id);

-- Parcelas: cada linha é UMA parcela. Venda à vista = 1 linha já paga.
create table public.parcelas (
    id          uuid primary key default gen_random_uuid(),
    item_id     uuid not null references public.itens(id) on delete cascade,
    numero      int not null,
    valor       numeric(12,2) not null,
    vencimento  date not null,
    pago        boolean not null default false,
    pago_em     date,
    created_at  timestamptz not null default now()
);
create index idx_parcelas_item on public.parcelas(item_id);
create index idx_parcelas_vencimento on public.parcelas(vencimento) where pago = false;


-- =====================================================================
-- VIEW: itens_calculados
-- Custo detalhado por unidade (lote proporcional + extras igual + conserto
-- só se decisao='consertar') e sugestão de preço (mercado-ancorado).
-- =====================================================================
create or replace view public.itens_calculados as
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
    -- sugestão: íntegro/consertar = 88% do mercado; no-estado = 55% do mercado
    round(i.valor_referencia * case when i.condicao='defeito' and i.decisao='estado' then 0.55 else 0.88 end, 2)
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


-- =====================================================================
-- VIEW: resumo_lotes — igual à v1 (custo total, recuperado, break-even)
-- =====================================================================
create or replace view public.resumo_lotes as
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


-- =====================================================================
-- VIEW: contas_a_receber — parcelas abertas, com flag de vencida
-- =====================================================================
create or replace view public.contas_a_receber as
select
    p.id, p.item_id, i.modelo, i.cliente_nome, i.cliente_contato,
    p.numero, p.valor, p.vencimento, p.pago,
    (p.pago = false and p.vencimento < current_date) as vencida
from public.parcelas p
join public.itens i on i.id = p.item_id
where p.pago = false
order by p.vencimento asc;


-- =====================================================================
-- SEGURANÇA — RLS desligado por padrão (uso interno). Antes de expor
-- publicamente ou multiusuário real, ativar:
-- alter table public.lotes enable row level security;
-- alter table public.custos_extras enable row level security;
-- alter table public.itens enable row level security;
-- alter table public.parcelas enable row level security;
-- create policy "auth" on public.lotes for all to authenticated using (true) with check (true);
-- (repetir para as demais tabelas)
-- =====================================================================
