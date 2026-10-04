-- Excedentes en la moneda del negocio (2026-10-04). `charge_usd` guarda el
-- importe en la moneda de `charge_currency`: hasta hoy siempre fue dólares.
alter table public.usage_periods
  add column if not exists charge_currency text not null default 'usd'
  check (charge_currency in ('usd', 'mxn'));
