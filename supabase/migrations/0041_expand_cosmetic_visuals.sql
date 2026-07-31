-- Expand avatar borders, level borders, and banners across E-S rarities.
-- Existing seeds are left intact; this only inserts new ids.

insert into public.cosmetic_items (id, kind, rarity, name, description, style) values
  -- ── Avatar borders ────────────────────────────────────────────────────────
  -- E
  ('avatar_border_graphite', 'avatar_border', 'E', 'Graphite Ring', 'Matte charcoal trim.',
    '{"colors":["#A1A1AA","#52525B"],"glow":"#A1A1AA","width":3}'::jsonb),
  ('avatar_border_mist', 'avatar_border', 'E', 'Mist Ring', 'Soft fog outline.',
    '{"colors":["#E2E8F0","#94A3B8"],"glow":"#CBD5E1","width":3}'::jsonb),
  ('avatar_border_sand', 'avatar_border', 'E', 'Sand Ring', 'Warm desert dust.',
    '{"colors":["#D6B28A","#A8794A"],"glow":"#D6B28A","width":3}'::jsonb),
  -- D
  ('avatar_border_copper', 'avatar_border', 'D', 'Copper Ring', 'Worked metal sheen.',
    '{"colors":["#F0A060","#B45309"],"glow":"#F0A060","width":3}'::jsonb),
  ('avatar_border_forest', 'avatar_border', 'D', 'Forest Ring', 'Deep canopy green.',
    '{"colors":["#4ADE80","#166534"],"glow":"#4ADE80","width":3}'::jsonb),
  ('avatar_border_tide', 'avatar_border', 'D', 'Tide Ring', 'Coastal blue wash.',
    '{"colors":["#67E8F9","#0891B2"],"glow":"#67E8F9","width":3}'::jsonb),
  -- C
  ('avatar_border_volt', 'avatar_border', 'C', 'Volt Ring', 'Charged yellow arc.',
    '{"colors":["#FDE047","#EAB308"],"glow":"#FACC15","width":3}'::jsonb),
  ('avatar_border_magenta', 'avatar_border', 'C', 'Magenta Ring', 'Hot pink pulse.',
    '{"colors":["#F472B6","#DB2777"],"glow":"#F472B6","width":3}'::jsonb),
  ('avatar_border_mint', 'avatar_border', 'C', 'Mint Ring', 'Cool mint flash.',
    '{"colors":["#5EEAD4","#0D9488"],"glow":"#5EEAD4","width":3}'::jsonb),
  -- B
  ('avatar_border_solar', 'avatar_border', 'B', 'Solar Ring', 'Burning daylight rim.',
    '{"colors":["#FBBF24","#F97316","#EF4444"],"glow":"#FBBF24","width":3}'::jsonb),
  ('avatar_border_ice', 'avatar_border', 'B', 'Ice Ring', 'Frozen crystal edge.',
    '{"colors":["#E0F2FE","#38BDF8","#6366F1"],"glow":"#7DD3FC","width":3}'::jsonb),
  ('avatar_border_neon', 'avatar_border', 'B', 'Neon Ring', 'Night-city glow.',
    '{"colors":["#22D3EE","#A855F7"],"glow":"#22D3EE","width":3}'::jsonb),
  -- A
  ('avatar_border_obsidian', 'avatar_border', 'A', 'Obsidian Ring', 'Black-glass flare.',
    '{"colors":["#334155","#0F172A","#F8FAFC"],"glow":"#94A3B8","width":4}'::jsonb),
  ('avatar_border_plasma', 'avatar_border', 'A', 'Plasma Ring', 'Unstable hot plasma.',
    '{"colors":["#FB7185","#C026D3","#6366F1"],"glow":"#FB7185","width":4}'::jsonb),
  ('avatar_border_gilded', 'avatar_border', 'A', 'Gilded Ring', 'Royal gold trim.',
    '{"colors":["#FDE68A","#F59E0B","#B45309"],"glow":"#FBBF24","width":4}'::jsonb),
  -- S
  ('avatar_border_prism', 'avatar_border', 'S', 'Prism Ring', 'Full-spectrum refraction.',
    '{"colors":["#EF4444","#F59E0B","#22C55E","#3B82F6","#A855F7"],"glow":"#C084FC","width":4}'::jsonb),
  ('avatar_border_abyss', 'avatar_border', 'S', 'Abyss Ring', 'Bottomless violet void.',
    '{"colors":["#312E81","#4C1D95","#F0ABFC"],"glow":"#E879F9","width":4}'::jsonb),

  -- ── Level borders ─────────────────────────────────────────────────────────
  -- E
  ('level_border_ash', 'level_border', 'E', 'Ash Frame', 'Soft gray badge trim.',
    '{"colors":["#E2E8F0","#64748B"],"glow":"#94A3B8","width":2}'::jsonb),
  ('level_border_cobalt', 'level_border', 'E', 'Cobalt Frame', 'Quiet blue outline.',
    '{"colors":["#93C5FD","#3B82F6"],"glow":"#60A5FA","width":2}'::jsonb),
  ('level_border_khaki', 'level_border', 'E', 'Khaki Frame', 'Training-ground tan.',
    '{"colors":["#D6D3D1","#A8A29E"],"glow":"#A8A29E","width":2}'::jsonb),
  -- D
  ('level_border_bronze', 'level_border', 'D', 'Bronze Frame', 'Cast bronze edge.',
    '{"colors":["#FDBA74","#C2410C"],"glow":"#FB923C","width":2}'::jsonb),
  ('level_border_teal', 'level_border', 'D', 'Teal Frame', 'Deep teal shimmer.',
    '{"colors":["#2DD4BF","#0F766E"],"glow":"#2DD4BF","width":2}'::jsonb),
  ('level_border_lilac', 'level_border', 'D', 'Lilac Frame', 'Soft violet rim.',
    '{"colors":["#C4B5FD","#7C3AED"],"glow":"#A78BFA","width":2}'::jsonb),
  -- C
  ('level_border_amber', 'level_border', 'C', 'Amber Frame', 'Hard amber glow.',
    '{"colors":["#FCD34D","#D97706"],"glow":"#FBBF24","width":2}'::jsonb),
  ('level_border_sapphire', 'level_border', 'C', 'Sapphire Frame', 'Cut-blue crystal.',
    '{"colors":["#60A5FA","#1D4ED8"],"glow":"#60A5FA","width":2}'::jsonb),
  ('level_border_rose', 'level_border', 'C', 'Rose Frame', 'Blush metal trim.',
    '{"colors":["#FDA4AF","#E11D48"],"glow":"#FB7185","width":2}'::jsonb),
  -- B
  ('level_border_neon', 'level_border', 'B', 'Neon Frame', 'Electric outline.',
    '{"colors":["#4ADE80","#22D3EE"],"glow":"#4ADE80","width":3}'::jsonb),
  ('level_border_royal', 'level_border', 'B', 'Royal Frame', 'Deep purple crest.',
    '{"colors":["#C084FC","#6D28D9"],"glow":"#C084FC","width":3}'::jsonb),
  ('level_border_inferno', 'level_border', 'B', 'Inferno Frame', 'Flame-edged badge.',
    '{"colors":["#FB923C","#DC2626"],"glow":"#F97316","width":3}'::jsonb),
  -- A
  ('level_border_gold', 'level_border', 'A', 'Gold Frame', 'Polished champion gold.',
    '{"colors":["#FDE68A","#EAB308","#A16207"],"glow":"#FACC15","width":3}'::jsonb),
  ('level_border_magma', 'level_border', 'A', 'Magma Frame', 'Molten core rim.',
    '{"colors":["#F97316","#B91C1C","#7F1D1D"],"glow":"#FB923C","width":3}'::jsonb),
  ('level_border_arctic', 'level_border', 'A', 'Arctic Frame', 'Glacial white-blue.',
    '{"colors":["#F8FAFC","#38BDF8","#1E3A8A"],"glow":"#7DD3FC","width":3}'::jsonb),
  -- S
  ('level_border_sovereign', 'level_border', 'S', 'Sovereign Frame', 'Absolute authority trim.',
    '{"colors":["#FBBF24","#A855F7","#EF4444"],"glow":"#F0ABFC","width":3}'::jsonb),
  ('level_border_singularity', 'level_border', 'S', 'Singularity Frame', 'Event-horizon rim.',
    '{"colors":["#0F172A","#6366F1","#F472B6"],"glow":"#818CF8","width":3}'::jsonb),

  -- ── Banners ───────────────────────────────────────────────────────────────
  -- E
  ('banner_fog', 'banner', 'E', 'Fog Drift', 'Muted gray haze.',
    '{"colors":["#CBD5E1","#94A3B8","#64748B"]}'::jsonb),
  ('banner_meadow', 'banner', 'E', 'Meadow Run', 'Soft green field.',
    '{"colors":["#BBF7D0","#86EFAC","#4ADE80"]}'::jsonb),
  ('banner_chalk', 'banner', 'E', 'Chalk Wall', 'Clean studio wash.',
    '{"colors":["#F8FAFC","#E2E8F0","#CBD5E1"]}'::jsonb),
  -- D
  ('banner_sunset', 'banner', 'D', 'Sunset Strip', 'Warm evening fade.',
    '{"colors":["#FDBA74","#FB7185","#C084FC"]}'::jsonb),
  ('banner_storm', 'banner', 'D', 'Storm Front', 'Thunderhead blues.',
    '{"colors":["#64748B","#334155","#0EA5E9"]}'::jsonb),
  ('banner_canyon', 'banner', 'D', 'Canyon Dust', 'Red-rock heat.',
    '{"colors":["#FDBA74","#EA580C","#7C2D12"]}'::jsonb),
  -- C
  ('banner_neon_city', 'banner', 'C', 'Neon City', 'Night alley neon.',
    '{"colors":["#22D3EE","#A855F7","#F43F5E"]}'::jsonb),
  ('banner_canopy', 'banner', 'C', 'Forest Canopy', 'Deep leaf cover.',
    '{"colors":["#4ADE80","#15803D","#14532D"]}'::jsonb),
  ('banner_berry', 'banner', 'C', 'Berry Bloom', 'Rich berry fade.',
    '{"colors":["#F9A8D4","#DB2777","#701A75"]}'::jsonb),
  -- B
  ('banner_magma', 'banner', 'B', 'Magma Flow', 'Molten river wash.',
    '{"colors":["#FBBF24","#F97316","#7F1D1D"]}'::jsonb),
  ('banner_crystal', 'banner', 'B', 'Crystal Ice', 'Frozen prism light.',
    '{"colors":["#E0F2FE","#38BDF8","#6366F1"]}'::jsonb),
  ('banner_voltage', 'banner', 'B', 'Voltage Field', 'Electric green surge.',
    '{"colors":["#A3E635","#22D3EE","#0F172A"]}'::jsonb),
  -- A
  ('banner_royal_dusk', 'banner', 'A', 'Royal Dusk', 'Crown-violet nightfall.',
    '{"colors":["#FDE68A","#A855F7","#1E1B4B"]}'::jsonb),
  ('banner_solar_flare', 'banner', 'A', 'Solar Flare', 'Blinding star burst.',
    '{"colors":["#FEF3C7","#F59E0B","#DC2626"]}'::jsonb),
  ('banner_blood_moon', 'banner', 'A', 'Blood Moon', 'Crimson lunar haze.',
    '{"colors":["#FECACA","#E11D48","#3B0764"]}'::jsonb),
  -- S
  ('banner_singularity', 'banner', 'S', 'Singularity', 'Collapse into light.',
    '{"colors":["#0F172A","#4F46E5","#F472B6","#FDE68A"]}'::jsonb),
  ('banner_spectrum', 'banner', 'S', 'Full Spectrum', 'Every wavelength at once.',
    '{"colors":["#EF4444","#F59E0B","#22C55E","#3B82F6","#A855F7"]}'::jsonb)
on conflict (id) do nothing;
