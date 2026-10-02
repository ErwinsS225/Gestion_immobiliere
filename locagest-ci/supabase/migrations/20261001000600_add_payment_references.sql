-- Migration 7 : references de paiement et etat des reglements.
-- Depend de 20261001000100_create_business_schema.sql (table public.payments).
--
-- La table payments a ete creee pour tracer des montants encaisses. Elle ne
-- comportait qu un champ notes libre, sans reference ni statut : impossible de
-- distinguer un reglement confirme d une operation rejetee par l operateur, ni
-- de redonner a l agent la reference qu il aura cite au telephone.
--
-- La reference est propre a chaque ligne : en mode reel, un webhook ne peut pas
-- confirmer deux fois la meme operation.

alter table public.payments
  add column if not exists reference text,
  add column if not exists status text not null default 'confirmed',
  add column if not exists rejection_reason text;

do $constraints$
begin
  alter table public.payments
    add constraint payments_status_allowed check (
      status in ('pending', 'confirmed', 'rejected')
    );
exception
  when duplicate_object then null;
end;
$constraints$;

-- La contrainte de la migration 2 exigeait amount > 0, ce qui interdisait
-- d enregistrer un rejet : une operation non aboutie porte forcement un montant
-- nul, sinon elle diminuerait l encaisse d une somme jamais recue.
--
-- Elle est donc remplacee par une regle qui distingue les deux cas :
--   confirmed ou pending : un montant strictement positif est requis
--   rejected             : montant nul et motif obligatoire
do $constraints$
begin
  alter table public.payments
    drop constraint if exists payments_amount_positive;
exception
  when undefined_object then null;
end;
$constraints$;

do $constraints$
begin
  alter table public.payments
    add constraint payments_amount_consistent check (
      (status = 'rejected' and amount = 0
        and rejection_reason is not null
        and pg_catalog.length(pg_catalog.btrim(rejection_reason)) > 0)
      or (status in ('pending', 'confirmed') and amount > 0)
    );
exception
  when duplicate_object then null;
end;
$constraints$;

-- La reference suit le format produit par le serveur, prefixe de l operateur
-- puis date et numero sur quatre chiffres : WV-20261015-4127. Les lignes creees
-- avant cette migration n en portent pas et restent valides, la contrainte ne
-- portant que sur les valeurs renseignees.
do $constraints$
begin
  alter table public.payments
    add constraint payments_reference_format check (
      reference is null or reference ~ '^[A-Z]{3}-[0-9]{8}-[0-9]{4}$'
    );
exception
  when duplicate_object then null;
end;
$constraints$;

create unique index if not exists payments_reference_key
  on public.payments (reference)
  where reference is not null;

create index if not exists payments_paid_at_idx on public.payments (paid_at);

-- ---------------------------------------------------------------------------
-- Recalcul de l echeance
--
-- La fonction de la migration 2 additionnait tous les paiements. Elle doit desormais
-- ne retenir que les reglements confirmes : un rejet et une operation en attente
-- sont traces, mais ne changent ni l encaisse ni le statut de l echeance.
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_rent_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous_rent_call_id uuid;
begin
  if tg_op = 'DELETE' then
    perform public.refresh_rent_call_totals(old.rent_call_id);
    return null;
  end if;

  if tg_op = 'UPDATE' and new.rent_call_id is distinct from old.rent_call_id then
    perform public.refresh_rent_call_totals(old.rent_call_id);
  end if;

  perform public.refresh_rent_call_totals(new.rent_call_id);
  return null;
end;
$function$;

create or replace function public.refresh_rent_call_totals(p_rent_call_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_total numeric(14, 2);
  v_paid numeric(14, 2);
  v_due_date date;
  v_etat public.rent_call_status;
begin
  select rent_call.total_amount, rent_call.due_date
  into v_total, v_due_date
  from public.rent_calls as rent_call
  where rent_call.id = p_rent_call_id;

  -- L echeance n existe plus, suppression en cascade : rien a recalculer.
  if not found then
    return;
  end if;

  select coalesce(sum(payment.amount), 0)
  into v_paid
  from public.payments as payment
  where payment.rent_call_id = p_rent_call_id
    and payment.status = 'confirmed';

  if v_total > 0 and v_paid >= v_total then
    v_etat := 'paid'::public.rent_call_status;
  elsif v_paid > 0 and v_due_date < (current_date - 5) then
    v_etat := 'overdue'::public.rent_call_status;
  elsif v_paid > 0 then
    v_etat := 'partial'::public.rent_call_status;
  elsif v_due_date < (current_date - 5) then
    v_etat := 'overdue'::public.rent_call_status;
  else
    v_etat := 'pending'::public.rent_call_status;
  end if;

  update public.rent_calls as rent_call
  set amount_paid = v_paid,
      status = v_etat
  where rent_call.id = p_rent_call_id;
end;
$function$;