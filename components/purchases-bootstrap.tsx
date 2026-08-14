import { useEffect } from 'react';

import { useAuth } from '@/context/auth-context';
import { configurePurchases, syncPurchasesIdentity } from '@/lib/iap';

/** Configures RevenueCat once and keeps app_user_id = Supabase user id. */
export function PurchasesBootstrap() {
  const { session, isPending } = useAuth();

  useEffect(() => {
    void configurePurchases();
  }, []);

  useEffect(() => {
    if (isPending) return;
    void syncPurchasesIdentity(session?.user.id ?? null);
  }, [isPending, session?.user.id]);

  return null;
}
