-- Replace title cosmetics with the curated E / D / C title catalog.
-- Flavor copy is stored in `description`.

-- Detach any equipped old titles first.
update public.profiles
set equipped_title_id = null
where equipped_title_id in (
  select id from public.cosmetic_items where kind = 'title'
);

-- Drop ownership / starter-crate rows pointing at old titles.
delete from public.user_cosmetics
where cosmetic_id in (
  select id from public.cosmetic_items where kind = 'title'
);

delete from public.user_starter_cosmetic_crates
where cosmetic_id in (
  select id from public.cosmetic_items where kind = 'title'
);

delete from public.cosmetic_items
where kind = 'title';

insert into public.cosmetic_items (id, kind, rarity, name, description, style) values
  -- E (Common)
  ('title_day_one', 'title', 'E', 'Day One', 'First workout logged.', '{}'::jsonb),
  ('title_just_showed_up', 'title', 'E', 'Just Showed Up', 'First week.', '{}'::jsonb),
  ('title_fresh_plates', 'title', 'E', 'Fresh Plates', 'First weight session.', '{}'::jsonb),
  ('title_warm_up_king', 'title', 'E', 'Warm Up King', 'Completed first warmup routine.', '{}'::jsonb),
  ('title_locker_room_regular', 'title', 'E', 'Locker Room Regular', '5 visits logged.', '{}'::jsonb),
  ('title_sweat_starter', 'title', 'E', 'Sweat Starter', 'First cardio session.', '{}'::jsonb),
  ('title_rep_one', 'title', 'E', 'Rep One', 'First rep tracked.', '{}'::jsonb),
  ('title_stretcher', 'title', 'E', 'Stretcher', 'First flexibility/cooldown logged.', '{}'::jsonb),
  ('title_rookie', 'title', 'E', 'Rookie', 'First full workout completed.', '{}'::jsonb),

  -- D (Uncommon)
  ('title_no_days_off', 'title', 'D', 'No Days Off', 'Streak-based.', '{}'::jsonb),
  ('title_rep_chaser', 'title', 'D', 'Rep Chaser', 'High volume workouts.', '{}'::jsonb),
  ('title_iron_will', 'title', 'D', 'Iron Will', 'Pushed through hard sessions.', '{}'::jsonb),
  ('title_grind_mode', 'title', 'D', 'Grind Mode', 'Multiple sessions in a week.', '{}'::jsonb),
  ('title_pr_hunter', 'title', 'D', 'PR Hunter', 'Hit several personal records.', '{}'::jsonb),
  ('title_sweat_machine', 'title', 'D', 'Sweat Machine', 'Cardio-focused.', '{}'::jsonb),
  ('title_the_grinder', 'title', 'D', 'The Grinder', 'Long session durations.', '{}'::jsonb),
  ('title_calorie_crusher', 'title', 'D', 'Calorie Crusher', 'Output-based.', '{}'::jsonb),
  ('title_early_riser', 'title', 'D', 'Early Riser', 'Morning workout streak.', '{}'::jsonb),
  ('title_set_destroyer', 'title', 'D', 'Set Destroyer', 'Completed every set, no skips.', '{}'::jsonb),

  -- C (Rare)
  ('title_iron_giant', 'title', 'C', 'Iron Giant', 'Heavy lifter milestone.', '{}'::jsonb),
  ('title_beast_mode', 'title', 'C', 'Beast Mode', 'Intensity-based.', '{}'::jsonb),
  ('title_the_machine', 'title', 'C', 'The Machine', 'Consistency over months.', '{}'::jsonb),
  ('title_peak_performer', 'title', 'C', 'Peak Performer', 'Hit all metrics in a period.', '{}'::jsonb),
  ('title_apex_athlete', 'title', 'C', 'Apex Athlete', 'All-around excellence.', '{}'::jsonb),
  ('title_sculpted', 'title', 'C', 'Sculpted', 'Body composition goal reached.', '{}'::jsonb),
  ('title_unstoppable', 'title', 'C', 'Unstoppable', 'Long streak with no missed workouts.', '{}'::jsonb),
  ('title_elite_form', 'title', 'C', 'Elite Form', 'Perfect technique ratings.', '{}'::jsonb);
