-- New enum values must be committed before use (separate migration).
alter type public.xp_award_kind add value if not exists 'crate_reward';
