import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import { useAwardAchievements } from '@/hooks/use-award-achievements';
import { queryKeys } from '@/lib/query-keys';
import { parseCrateContents } from '@/lib/rewards';
import {
  parseShopPurchaseResult,
  parseShopStock,
  type ShopPurchaseResult,
  type ShopStock,
} from '@/lib/shop';
import { supabase } from '@/lib/supabase';
import type { CrateReward } from '@/lib/rewards';

export function useShopStock() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: queryKeys.shopStock(userId),
    enabled: !!userId,
    queryFn: async (): Promise<ShopStock> => {
      const { data, error } = await supabase.rpc('get_shop_stock');
      if (error) throw error;
      const stock = parseShopStock(data);
      if (!stock) throw new Error('Shop returned invalid stock');
      return stock;
    },
    refetchInterval: 60_000,
  });
}

export function usePurchaseShopListing() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const awardAchievements = useAwardAchievements();

  return useMutation({
    mutationFn: async (
      listingId: string,
    ): Promise<ShopPurchaseResult & { rewards: CrateReward[] }> => {
      const { data, error } = await supabase.rpc('purchase_shop_listing', {
        p_listing_id: listingId,
      });
      if (error) throw error;

      const result = parseShopPurchaseResult(data);
      if (!result) throw new Error('Purchase returned an invalid payload');

      const contents = parseCrateContents(result.contents as never);
      if (!contents) throw new Error('Purchase returned invalid rewards');

      return { ...result, rewards: contents.rewards };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopStock(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.ownedCosmetics(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rewardCrates(userId) });
      void awardAchievements();
    },
  });
}
