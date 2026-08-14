/**
 * RevenueCat webhook → grant Creds for consumable Cred bundles.
 *
 * Configure in RevenueCat → Integrations → Webhooks:
 *   URL:  https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
 *   Auth: Authorization header value matching REVENUECAT_WEBHOOK_AUTH secret
 *   Events: NON_RENEWING_PURCHASE (and optionally INITIAL_PURCHASE)
 *
 * Secrets:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   REVENUECAT_WEBHOOK_AUTH  — exact Authorization header value from RC
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface RevenueCatEvent {
  id?: string;
  type?: string;
  app_user_id?: string;
  product_id?: string;
  transaction_id?: string;
  store?: string;
  environment?: string;
}

interface RevenueCatWebhookPayload {
  api_version?: string;
  event?: RevenueCatEvent;
}

const GRANT_TYPES = new Set(["NON_RENEWING_PURCHASE", "INITIAL_PURCHASE"]);

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
    if (!expectedAuth) {
      return new Response(JSON.stringify({ error: "Webhook auth not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader !== expectedAuth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as RevenueCatWebhookPayload;
    const event = payload.event;
    if (!event?.type) {
      return new Response(JSON.stringify({ error: "Missing event" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!GRANT_TYPES.has(event.type)) {
      return new Response(JSON.stringify({ ok: true, ignored: event.type }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = event.app_user_id;
    const productId = event.product_id;
    const transactionId = event.transaction_id;
    if (!userId || !productId || !transactionId) {
      return new Response(
        JSON.stringify({ error: "Missing app_user_id, product_id, or transaction_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Anonymous RC ids should never receive Creds — app always logIn(supabaseUserId).
    if (userId.startsWith("$RCAnonymousID:")) {
      return new Response(
        JSON.stringify({ error: "Anonymous RevenueCat user cannot receive Creds" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data, error } = await admin.rpc("grant_iap_creds", {
      p_user_id: userId,
      p_product_id: productId,
      p_store_transaction_id: transactionId,
      p_revenuecat_event_id: event.id ?? null,
      p_store: event.store ?? null,
      p_environment: event.environment ?? null,
    });

    if (error) {
      console.error("[revenuecat-webhook] grant_iap_creds failed", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, result: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[revenuecat-webhook] unhandled", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
