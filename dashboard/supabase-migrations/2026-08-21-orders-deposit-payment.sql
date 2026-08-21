-- Autorise le mode de paiement DEPOSIT (réservation avec acompte)
-- pour la messagerie native Tikchop (Djassaman).
-- Safe to rerun.

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (
    payment_method IN (
      'WAVE',
      'ORANGE_MONEY',
      'MTN_MONEY',
      'CASH_ON_DELIVERY',
      'PAYSTACK',
      'DEPOSIT'
    )
  );

notify pgrst, 'reload schema';