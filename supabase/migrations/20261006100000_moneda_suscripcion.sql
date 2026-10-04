-- =====================================================================
-- Moneda de la suscripción (2026-10-04): los negocios de México pagan en
-- pesos (más IVA); el resto, en dólares.
--
--   currency = la moneda en que Stripe le cobra a ESTA suscripción. La escribe
--   el webhook desde el objeto de Stripe. Vacía mientras el negocio no paga:
--   así la moneda la decide su país al contratar, y no un valor por defecto.
--
--   Aditiva: no cambia nada de lo que hoy cobra en dólares.
-- =====================================================================
alter table public.subscriptions
  add column if not exists currency text check (currency in ('usd', 'mxn'));

-- Las suscripciones que ya existen en Stripe se cobran en dólares.
update public.subscriptions
   set currency = 'usd'
 where currency is null
   and stripe_subscription_id is not null;
