import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/context/auth-context';
import {
  fulfillPendingIapPurchases,
  getCustomerInfo,
  getLivePriceLabels,
  isIapConfigured,
  presentCustomerCenter,
  purchaseCredsPack,
  restorePurchases,
} from '@/lib/iap';
import { queryKeys } from '@/lib/query-keys';
import type { CredsPackId } from '@/lib/shop';

export function useIapConfigured(): boolean {
  return isIapConfigured();
}

export function useCredsPackPrices() {
  return useQuery({
    queryKey: ['iap', 'creds-pack-prices'],
    queryFn: getLivePriceLabels,
    enabled: isIapConfigured(),
    staleTime: 5 * 60_000,
  });
}

export function useCustomerInfo() {
  return useQuery({
    queryKey: ['iap', 'customer-info'],
    queryFn: getCustomerInfo,
    enabled: isIapConfigured(),
    staleTime: 60_000,
  });
}

function invalidateIapQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
  void queryClient.invalidateQueries({ queryKey: ['iap'] });
}

export function usePurchaseCredsPack() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: (packId: CredsPackId) => purchaseCredsPack(packId),
    onSuccess: () => invalidateIapQueries(queryClient, userId),
  });
}

export function useFulfillPendingIap() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: () => fulfillPendingIapPurchases(),
    onSuccess: () => invalidateIapQueries(queryClient, userId),
  });
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;

  return useMutation({
    mutationFn: () => restorePurchases(),
    onSuccess: () => invalidateIapQueries(queryClient, userId),
  });
}

export function usePresentCustomerCenter() {
  return useMutation({
    mutationFn: () => presentCustomerCenter(),
  });
}
