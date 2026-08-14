/**
 * After a store purchase, sync the caller's RevenueCat subscriber record and
 * grant any Cred-bundle transactions not yet in public.iap_purchases.
 *
 * Auth: caller JWT (verify_jwt = true).
 *
 * Secrets:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   REVENUECAT_SECRET_API_KEY  — RevenueCat secret key (sk_…)
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

const KNOWN_PRODUCTS = new Set([
  "com.danielchungneo.gaingang.creds.hustle",
  "com.danielchungneo.gaingang.creds.beast",
  "com.danielchungneo.gaingang.creds.apex",
]);

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

    const rcRes = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      {
        headers: {
          Authorization: `Bearer ${rcSecret}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!rcRes.ok) {
      const body = await rcRes.text();
      console.error("[fulfill-iap] RevenueCat subscriber fetch failed", rcRes.status, body);
      return new Response(JSON.stringify({ error: "Could not verify purchases" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rcJson = (await rcRes.json()) as SubscriberResponse;
    const nonSubs = rcJson.subscriber?.non_subscriptions ?? {};

    let amountGranted = 0;
    let balance = 0;
    let alreadyFulfilled = true;

    const { data: profile } = await admin
      .from("profiles")
      .select("currency")
      .eq("id", user.id)
      .maybeSingle();
    balance = typeof profile?.currency === "number" ? profile.currency : 0;

    for (const [productId, purchases] of Object.entries(nonSubs)) {
      if (!KNOWN_PRODUCTS.has(productId) || !Array.isArray(purchases)) continue;

      for (const purchase of purchases) {
        const storeTxn =
          purchase.store_transaction_id ??
          (typeof purchase.id === "string" ? purchase.id : null);
        if (!storeTxn) continue;

        const { data, error } = await admin.rpc("grant_iap_creds", {
          p_user_id: user.id,
          p_product_id: productId,
          p_store_transaction_id: storeTxn,
          p_revenuecat_event_id: null,
          p_store: null,
          p_environment: null,
        });

        if (error) {
          console.error("[fulfill-iap] grant failed", productId, storeTxn, error);
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
