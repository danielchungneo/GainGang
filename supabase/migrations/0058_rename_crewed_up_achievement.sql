-- Rename achievement title: Crewed Up → Ganged Up (product language is Gang, not crew).

update public.achievements
set title = 'Ganged Up'
where key = 'join_gang'
  and title = 'Crewed Up';
