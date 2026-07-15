/**
 * Dispatches an Expo push notification for a GainGang in-app alert.
 *
 * Wire this to a Supabase Database Webhook on `public.notifications` INSERT
 * (or invoke with `{ "notification_id": "..." }` using the service role).
 *
 * Secrets:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  body: string;
  activity_id: string | null;
  gang_id: string | null;
  daily_goal_id: string | null;
}

function titleForType(type: string): string {
  switch (type) {
    case "kudos":
      return "New kudos";
    case "comment":
      return "New comment";
    case "poke":
      return "You've been poked";
    case "daily_goal":
      return "Daily goal crushed";
    default:
      return "GainGang";
  }
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
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    // Database Webhooks wrap the row under `record`; direct calls use notification_id.
    const record = (payload.record ?? null) as NotificationRow | null;
    const notificationId =
      record?.id ??
      (typeof payload.notification_id === "string" ? payload.notification_id : null);

    if (!notificationId) {
      return new Response(JSON.stringify({ error: "notification_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let notification = record;
    if (!notification?.user_id || !notification?.body) {
      const { data, error } = await admin
        .from("notifications")
        .select("id, user_id, type, body, activity_id, gang_id, daily_goal_id")
        .eq("id", notificationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return new Response(JSON.stringify({ error: "Notification not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      notification = data as NotificationRow;
    }

    const { data: tokens, error: tokenError } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", notification.user_id);
    if (tokenError) throw tokenError;

    const expoTokens = (tokens ?? [])
      .map((row) => row.token)
      .filter((token): token is string => typeof token === "string" && token.length > 0);

    if (expoTokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = expoTokens.map((to) => ({
      to,
      sound: "default" as const,
      title: titleForType(notification!.type),
      body: notification!.body,
      data: {
        notificationId: notification!.id,
        type: notification!.type,
        activityId: notification!.activity_id,
        gangId: notification!.gang_id,
        dailyGoalId: notification!.daily_goal_id,
      },
    }));

    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const expoJson = await expoRes.json();

    return new Response(
      JSON.stringify({ sent: messages.length, expo: expoJson }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
