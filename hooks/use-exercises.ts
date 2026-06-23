import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';
import type { Exercise, ExerciseCategory } from '@/types';

/**
 * Exercises in the catalog. Returns global defaults (gang_id null) plus any
 * gang-custom exercises when a gangId is supplied. Filterable by category.
 */
export function useExercises(category?: ExerciseCategory, gangId?: string) {
  return useQuery({
    queryKey: queryKeys.exercises(category, gangId),
    queryFn: async (): Promise<Exercise[]> => {
      let query = supabase.from('exercises').select('*').order('name');
      if (category) query = query.eq('category', category);
      if (gangId) query = query.or(`gang_id.is.null,gang_id.eq.${gangId}`);
      else query = query.is('gang_id', null);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000, // catalog rarely changes
  });
}
