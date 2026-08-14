import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';

import { CREDS_PACKS, type CredsPackId } from '@/lib/shop';
import { supabase } from '@/lib/supabase';

let isConfigured = false;

function iosApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() || undefined;
}

function androidApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() || undefined;
}

export function isIapSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function isIapConfigured(): boolean {
  if (!isIapSupported()) return false;
  if (Platform.OS === 'ios') return !!iosApiKey();
  return !!androidApiKey();
}

/** Call once at app start (native only). Safe to call repeatedly. */
export async function configurePurchases(): Promise<void> {
  if (!isIapSupported() || isConfigured) return;

  const apiKey = Platform.OS === 'ios' ? iosApiKey() : androidApiKey();
  if (!apiKey) {
    console.warn('[iap] RevenueCat API key missing — Cred bundles stay offline');
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
  Purchases.configure({ apiKey });
  isConfigured = true;
}

export async function syncPurchasesIdentity(userId: string | null): Promise<void> {
  if (!isIapConfigured() || !isConfigured) return;

  try {
    if (userId) {
      await Purchases.logIn(userId);
      return;
    }

    // logOut throws if already anonymous — skip in that case.
    const isAnonymous = await Purchases.isAnonymous();
    if (!isAnonymous) await Purchases.logOut();
  } catch (error) {
    console.warn('[iap] identity sync failed', error);
  }
}

/** Latest CustomerInfo from RevenueCat (used for restore / support). */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isIapConfigured()) return null;

  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.warn('[iap] getCustomerInfo failed', error);
    return null;
  }
}

export async function getPackageForPackId(
  packId: CredsPackId,
): Promise<PurchasesPackage | null> {
  if (!isIapConfigured()) return null;

  const pack = CREDS_PACKS.find((p) => p.id === packId);
  if (!pack) return null;

  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return (
    packages.find((pkg) => pkg.product.identifier === pack.productId) ?? null
  );
}

export async function getLivePriceLabels(): Promise<
  Partial<Record<CredsPackId, string>>
> {
  if (!isIapConfigured()) return {};

  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const labels: Partial<Record<CredsPackId, string>> = {};

    for (const credPack of CREDS_PACKS) {
      const match = packages.find(
        (pkg) => pkg.product.identifier === credPack.productId,
      );
      if (match?.product.priceString) labels[credPack.id] = match.product.priceString;
    }
    return labels;
  } catch (error) {
    console.warn('[iap] failed to load live prices', error);
    return {};
  }
}

export interface PurchaseCredsPackResult {
  amountGranted: number;
  balance: number;
  alreadyFulfilled: boolean;
}

/**
 * Starts the store purchase sheet for a Cred bundle, then asks our backend
 * to grant Creds from RevenueCat's subscriber record (idempotent).
 * App access is never gated on purchases — this is an optional top-up only.
 */
export async function purchaseCredsPack(
  packId: CredsPackId,
): Promise<PurchaseCredsPackResult> {
  if (!isIapConfigured()) {
    throw new Error('In-app purchases are not configured on this build.');
  }

  const pkg = await getPackageForPackId(packId);
  if (!pkg) {
    throw new Error(
      'This Cred bundle is not available in the store yet. Try again after products go live.',
    );
  }

  try {
    await Purchases.purchasePackage(pkg);
  } catch (error) {
    const purchasesError = error as PurchasesError;
    if (purchasesError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      throw new Error('Purchase cancelled');
    }
    throw error instanceof Error ? error : new Error('Purchase failed');
  }

  return fulfillPendingIapPurchases();
}

/** Sync any unfulfilled store purchases into profiles.currency. */
export async function fulfillPendingIapPurchases(): Promise<PurchaseCredsPackResult> {
  const { data, error } = await supabase.functions.invoke('fulfill-iap', {
    method: 'POST',
    body: {},
  });

  if (error) throw error;

  const payload = data as {
    amount_granted?: number;
    balance?: number;
    already_fulfilled?: boolean;
    error?: string;
  } | null;

  if (!payload || typeof payload.balance !== 'number') {
    throw new Error(payload?.error ?? 'Could not grant Creds for this purchase');
  }

  return {
    amountGranted: payload.amount_granted ?? 0,
    balance: payload.balance,
    alreadyFulfilled: !!payload.already_fulfilled,
  };
}

export function isPurchaseCancelledError(error: unknown): boolean {
  return error instanceof Error && error.message === 'Purchase cancelled';
}

/** Restore store purchases, then fulfill any missing Cred grants. */
export async function restorePurchases(): Promise<{
  customerInfo: CustomerInfo;
  fulfill: PurchaseCredsPackResult;
}> {
  if (!isIapConfigured()) {
    throw new Error('In-app purchases are not configured on this build.');
  }

  const customerInfo = await Purchases.restorePurchases();
  const fulfill = await fulfillPendingIapPurchases();
  return { customerInfo, fulfill };
}

/** Optional support UI (restore help) — never blocks app access. */
export async function presentCustomerCenter(): Promise<void> {
  if (!isIapConfigured()) {
    throw new Error('In-app purchases are not configured on this build.');
  }

  await RevenueCatUI.presentCustomerCenter();
}
