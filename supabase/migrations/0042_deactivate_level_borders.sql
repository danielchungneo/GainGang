-- Pause level border cosmetics until the visuals are redesigned.
-- Keeps rows in place so we can re-enable later without reseeding.

update public.profiles
set equipped_level_border_id = null
where equipped_level_border_id is not null;

update public.cosmetic_items
set active = false
where kind = 'level_border';
