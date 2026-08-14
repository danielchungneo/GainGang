/**
 * After a store purchase, sync the caller's RevenueCat subscriber record and
 * grant any Cred-bundle transactions not yet in public.iap_purchases.
 *
 * Auth: caller JWT (verify_jwt = true).
 *
 * Secrets:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   REVENUECAT_SECRET_API_KEY  — V2 secret key (sk_…) preferred
 *   REVENUECAT_PROJECT_ID      — e.g. projxxxxxx from dashboard URL (required for V2)
 *
 * V2 key permissions (minimum):
 *   customer_information:customers:read
 *   customer_information:purchases:read
 *   project_configuration:products:read
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface NonSubPurchase {
  id?: string;
  store_transaction_id?: string;
  purchase_date?: string;
}

interface SubscriberResponse {
  subscriber?: {
    non_subscriptions?: Record<string, NonSubPurchase[]>;
  };
}

interface V2Product {
  id?: string;
  store_identifier?: string;
}

interface V2Purchase {
  id?: string;
  product_id?: string;
  store_purchase_identifier?: string | number;
  status?: string;
  environment?: string;
  store?: string;
}

interface V2ListResponse<T> {
  items?: T[];
  next_page?: string | null;
}

const KNOWN_PRODUCTS = new Set([
  "com.danielchungneo.gaingang.creds.hustle",
  "com.danielchungneo.gaingang.creds.beast",
  "com.danielchungneo.gaingang.creds.apex",
]);

interface PendingGrant {
  productId: string;
  storeTransactionId: string;
  store?: string | null;
  environment?: string | null;
}

async function fetchAllPages<T>(
  firstUrl: string,
  headers: HeadersInit,
): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = firstUrl;

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`RevenueCat request failed ${res.status}: ${body}`);
    }
    const json = (await res.json()) as V2ListResponse<T>;
    if (Array.isArray(json.items)) items.push(...json.items);

    const next = json.next_page;
    if (!next) {
      url = null;
    } else if (next.startsWith("http")) {
      url = next;
    } else {
      url = `https://api.revenuecat.com${next.startsWith("/") ? "" : "/"}${next}`;
    }
  }

  return items;
}

async function collectGrantsFromV2(
  projectId: string,
  customerId: string,
  rcSecret: string,
): Promise<PendingGrant[]> {
  const headers = {
    Authorization: `Bearer ${rcSecret}`,
    "Content-Type": "application/json",
  };

  const products = await fetchAllPages<V2Product>(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/products?limit=100`,
    headers,
  );
  const storeIdByProductId = new Map<string, string>();
  for (const product of products) {
    if (product.id && product.store_identifier) {
      storeIdByProductId.set(product.id, product.store_identifier);
    }
  }

  const purchases = await fetchAllPages<V2Purchase>(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(customerId)}/purchases?limit=100`,
    headers,
  );

  const grants: PendingGrant[] = [];
  for (const purchase of purchases) {
    if (!purchase.product_id) continue;
    const storeProductId = storeIdByProductId.get(purchase.product_id);
    if (!storeProductId || !KNOWN_PRODUCTS.has(storeProductId)) continue;

    const storeTxn =
      purchase.store_purchase_identifier != null
        ? String(purchase.store_purchase_identifier)
        : typeof purchase.id === "string"
          ? purchase.id
          : null;
    if (!storeTxn) continue;

    grants.push({
      productId: storeProductId,
      storeTransactionId: storeTxn,
      store: purchase.store ?? null,
      environment: purchase.environment ?? null,
    });
  }

  return grants;
}

async function collectGrantsFromV1(
  customerId: string,
  rcSecret: string,
): Promise<PendingGrant[]> {
  const rcRes = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(customerId)}`,
    {
      headers: {
        Authorization: `Bearer ${rcSecret}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!rcRes.ok) {
    const body = await rcRes.text();
    throw new Error(`RevenueCat V1 subscriber fetch failed ${rcRes.status}: ${body}`);
  }

  const rcJson = (await rcRes.json()) as SubscriberResponse;
  const nonSubs = rcJson.subscriber?.non_subscriptions ?? {};
  const grants: PendingGrant[] = [];

  for (const [productId, purchases] of Object.entries(nonSubs)) {
    if (!KNOWN_PRODUCTS.has(productId) || !Array.isArray(purchases)) continue;
    for (const purchase of purchases) {
      const storeTxn =
        purchase.store_transaction_id ??
        (typeof purchase.id === "string" ? purchase.id : null);
      if (!storeTxn) continue;
      grants.push({
        productId,
        storeTransactionId: storeTxn,
      });
    }
  }

  return grants;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rcSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
    const projectId = Deno.env.get("REVENUECAT_PROJECT_ID")?.trim() || "";

    if (!supabaseUrl || !serviceKey || !rcSecret) {
      return new Response(JSON.stringify({ error: "Missing server env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const jwt = authHeader.slice("Bearer ".length).trim();
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let grants: PendingGrant[] = [];
    try {
      if (projectId) {
        grants = await collectGrantsFromV2(projectId, user.id, rcSecret);
      } else {
        grants = await collectGrantsFromV1(user.id, rcSecret);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[fulfill-iap] RevenueCat verify failed", message);

      // Common misconfig: V2 secret key without REVENUECAT_PROJECT_ID.
      if (message.includes("incompatible with RevenueCat API V1")) {
        return new Response(
          JSON.stringify({
            error:
              "RevenueCat V2 secret key requires REVENUECAT_PROJECT_ID in Supabase secrets (proj… from dashboard URL).",
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ error: "Could not verify purchases" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    let amountGranted = 0;
    let balance = 0;
    let alreadyFulfilled = true;

    const { data: profile } = await admin
      .from("profiles")
      .select("currency")
      .eq("id", user.id)
      .maybeSingle();
    balance = typeof profile?.currency === "number" ? profile.currency : 0;

    for (const grant of grants) {
      const { data, error } = await admin.rpc("grant_iap_creds", {
        p_user_id: user.id,
        p_product_id: grant.productId,
        p_store_transaction_id: grant.storeTransactionId,
        p_revenuecat_event_id: null,
        p_store: grant.store ?? null,
        p_environment: grant.environment ?? null,
      });

      if (error) {
        console.error(
          "[fulfill-iap] grant failed",
          grant.productId,
          grant.storeTransactionId,
          error,
        );
        continue;
      }

      const result = data as {
        amount_granted?: number;
        balance?: number;
        already_fulfilled?: boolean;
      } | null;

      if (typeof result?.balance === "number") balance = result.balance;
      if (typeof result?.amount_granted === "number" && result.amount_granted > 0) {
        amountGranted += result.amount_granted;
        alreadyFulfilled = false;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        amount_granted: amountGranted,
        balance,
        already_fulfilled: alreadyFulfilled && amountGranted === 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[fulfill-iap] unhandled", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
