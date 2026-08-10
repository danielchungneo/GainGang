-- Add gang_war_win as a reward crate source.
-- Must be committed before statements that reference the new enum value.

alter type public.reward_crate_source add value if not exists 'gang_war_win';
