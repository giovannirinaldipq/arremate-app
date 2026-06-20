-- =====================================================================
-- Migration 003 — Avaliador de oportunidades de lote
-- =====================================================================

create table public.oportunidades (
    id                    uuid primary key default gen_random_uuid(),
    descricao             text not null,
    origem                text,
    data_fechamento       timestamptz,
    valor_lance_estimado  numeric(12,2),
    valor_lance_dado      numeric(12,2),
    custo_extras_estimado numeric(12,2) not null default 0,
    status                text not null default 'avaliando',
    -- avaliando | lance_dado | arrematado | perdido
    observacoes           text,
    lote_convertido_id    uuid references public.lotes(id) on delete set null,
    created_at            timestamptz not null default now()
);

create table public.oportunidade_itens (
    id                uuid primary key default gen_random_uuid(),
    oportunidade_id   uuid not null references public.oportunidades(id) on delete cascade,
    modelo            text,
    valor_referencia  numeric(12,2) not null,
    condicao          text not null default 'ok',  -- ok | defeito
    created_at        timestamptz not null default now()
);

create index idx_oportunidade_itens_op on public.oportunidade_itens(oportunidade_id);

-- =====================================================================
-- VIEW: resumo_oportunidades — métricas calculadas para lista
-- =====================================================================
create or replace view public.resumo_oportunidades as
select
    o.*,
    count(oi.id)::int                                                         as qtd_itens,
    coalesce(sum(oi.valor_referencia), 0)                                     as soma_referencia,
    coalesce(sum(
        oi.valor_referencia *
        case when oi.condicao = 'defeito' then 0.55 else 0.88 end
    ), 0)                                                                     as receita_sugerida,
    coalesce(coalesce(o.valor_lance_dado, o.valor_lance_estimado, 0)
             + o.custo_extras_estimado, 0)                                    as custo_estimado,
    coalesce(sum(
        oi.valor_referencia *
        case when oi.condicao = 'defeito' then 0.55 else 0.88 end
    ), 0)
    - coalesce(coalesce(o.valor_lance_dado, o.valor_lance_estimado, 0)
               + o.custo_extras_estimado, 0)                                  as lucro_estimado
from public.oportunidades o
left join public.oportunidade_itens oi on oi.oportunidade_id = o.id
group by o.id;
