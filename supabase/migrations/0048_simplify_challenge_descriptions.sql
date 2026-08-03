-- Simplify weekly challenge type descriptions.

update public.challenge_types set description = 'Complete as many push-ups as you can in 60 seconds.'
where slug = 'pushups_60';

update public.challenge_types set description = 'Complete as many sit-ups as you can in 60 seconds.'
where slug = 'situps_60';

update public.challenge_types set description = 'Hold a plank for as long as you can.'
where slug = 'plank_max';

update public.challenge_types set description = 'Complete as many squats as you can in 60 seconds.'
where slug = 'squats_60';

update public.challenge_types set description = 'Complete as many crunches as you can in 60 seconds.'
where slug = 'crunches_60';
