-- Story 1.3 review: remove fake seed store (keep only д. Алабино, 92).

-- Point any preference at the default Alabino store before delete.
update public.user_settings
set
  selected_store_id = 'a1000000-0000-4000-8000-000000000001',
  updated_at = now()
where selected_store_id = 'a1000000-0000-4000-8000-000000000002';

delete from public.stores
where id = 'a1000000-0000-4000-8000-000000000002'
   or external_id = 'placeholder-second';
