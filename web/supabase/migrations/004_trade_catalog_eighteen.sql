-- Unify RenoFlow trade catalog to 18 slug ids (see web/src/lib/final-catalog.ts INTAKE_TRADE_IDS).

begin;

insert into public.trade_catalog (id, label, sort_order) values
  ('demo', 'Demolition', 10),
  ('framing', 'Framing / Bulkhead', 20),
  ('concrete', 'Concrete', 22),
  ('roofing', 'Roofing', 24),
  ('electrical', 'Electrical', 30),
  ('plumbing', 'Plumbing', 40),
  ('hvac', 'HVAC', 50),
  ('low-voltage', 'Low Voltage / Security / Commercial Door Hardware', 55),
  ('insulation', 'Insulation', 60),
  ('drywall', 'Drywall / Taping', 70),
  ('tile', 'Tile', 80),
  ('flooring', 'Flooring', 90),
  ('painting', 'Painting / Finishing', 100),
  ('doors-trim', 'Doors / Trim / Millwork', 110),
  ('cabinets', 'Cabinets & Tops', 120),
  ('closets', 'Closets', 125),
  ('landscaping', 'Landscaping / Deck / Fence / Sheds', 130),
  ('cleaning', 'Cleaning', 140)
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

with canon as (
  select
    prt.id,
    prt.room_id,
    prt.sort_order,
    case prt.trade_id
      when 'lowvolt' then 'low-voltage'
      when 'security' then 'low-voltage'
      when 'comdoor' then 'low-voltage'
      when 'trim' then 'doors-trim'
      when 'finishing' then 'painting'
      when 'bulkhead' then 'framing'
      when 'deck_fence' then 'landscaping'
      when 'deck-fence' then 'landscaping'
      else prt.trade_id
    end as new_tid
  from public.project_room_trades prt
),
ranked as (
  select id, row_number() over (partition by room_id, new_tid order by sort_order, id) as rn
  from canon
)
delete from public.project_room_trades prt
where prt.id in (select id from ranked where rn > 1);

update public.project_room_trades set trade_id = case trade_id
  when 'lowvolt' then 'low-voltage'
  when 'security' then 'low-voltage'
  when 'comdoor' then 'low-voltage'
  when 'trim' then 'doors-trim'
  when 'finishing' then 'painting'
  when 'bulkhead' then 'framing'
  when 'deck_fence' then 'landscaping'
  when 'deck-fence' then 'landscaping'
  else trade_id
end;

update public.trade_catalog_items set trade_id = case trade_id
  when 'lowvolt' then 'low-voltage'
  when 'security' then 'low-voltage'
  when 'comdoor' then 'low-voltage'
  when 'trim' then 'doors-trim'
  when 'finishing' then 'painting'
  when 'bulkhead' then 'framing'
  when 'deck_fence' then 'landscaping'
  when 'deck-fence' then 'landscaping'
  else trade_id
end;

delete from public.trade_catalog_items d
where d.ctid in (
  select ctid from (
    select ctid,
      row_number() over (partition by trade_id, code order by sort_order, id) as rn
    from public.trade_catalog_items
  ) x
  where rn > 1
);

update public.trade_catalog_fixtures set trade_id = case trade_id
  when 'lowvolt' then 'low-voltage'
  when 'security' then 'low-voltage'
  when 'comdoor' then 'low-voltage'
  when 'trim' then 'doors-trim'
  when 'finishing' then 'painting'
  when 'bulkhead' then 'framing'
  when 'deck_fence' then 'landscaping'
  when 'deck-fence' then 'landscaping'
  else trade_id
end;

delete from public.trade_catalog_fixtures d
where d.ctid in (
  select ctid from (
    select ctid,
      row_number() over (partition by trade_id, code order by sort_order, id) as rn
    from public.trade_catalog_fixtures
  ) x
  where rn > 1
);

with canon as (
  select room_template_id, trade_id,
    case trade_id
      when 'lowvolt' then 'low-voltage'
      when 'security' then 'low-voltage'
      when 'comdoor' then 'low-voltage'
      when 'trim' then 'doors-trim'
      when 'finishing' then 'painting'
      when 'bulkhead' then 'framing'
      when 'deck_fence' then 'landscaping'
      when 'deck-fence' then 'landscaping'
      else trade_id
    end as new_tid
  from public.room_template_trades
),
ranked as (
  select room_template_id, trade_id,
    row_number() over (partition by room_template_id, new_tid order by trade_id) as rn
  from canon
)
delete from public.room_template_trades rtt
using ranked r
where r.rn > 1
  and r.room_template_id = rtt.room_template_id
  and r.trade_id = rtt.trade_id;

update public.room_template_trades set trade_id = case trade_id
  when 'lowvolt' then 'low-voltage'
  when 'security' then 'low-voltage'
  when 'comdoor' then 'low-voltage'
  when 'trim' then 'doors-trim'
  when 'finishing' then 'painting'
  when 'bulkhead' then 'framing'
  when 'deck_fence' then 'landscaping'
  when 'deck-fence' then 'landscaping'
  else trade_id
end;

update public.custom_materials set trade_id = case trade_id
  when 'lowvolt' then 'low-voltage'
  when 'security' then 'low-voltage'
  when 'comdoor' then 'low-voltage'
  when 'trim' then 'doors-trim'
  when 'finishing' then 'painting'
  when 'bulkhead' then 'framing'
  when 'deck_fence' then 'landscaping'
  when 'deck-fence' then 'landscaping'
  else trade_id
end;

update public.profiles set selected_trades = replace(replace(replace(replace(replace(replace(replace(replace(
  selected_trades::text,
  '"lowvolt"', '"low-voltage"'),
  '"security"', '"low-voltage"'),
  '"comdoor"', '"low-voltage"'),
  '"trim"', '"doors-trim"'),
  '"finishing"', '"painting"'),
  '"bulkhead"', '"framing"'),
  '"deck_fence"', '"landscaping"'),
  '"deck-fence"', '"landscaping"')
)::jsonb;

delete from public.trade_catalog
where id in (
  'lowvolt', 'security', 'comdoor', 'trim', 'finishing', 'bulkhead', 'deck_fence', 'deck-fence'
);

commit;
