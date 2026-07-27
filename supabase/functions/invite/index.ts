/**
 * Public gang invite redirect.
 *
 * Supabase rewrites GET text/html → text/plain on *.supabase.co, so we cannot
 * serve a real landing page from an Edge Function. Instead we 302 to the app
 * custom scheme. Recipients without the app can use the App Store URL in the
 * SMS (or ?store=1 on this endpoint).
 *
 * Deploy with verify_jwt = false.
 *
 * Secrets (optional):
 *   APP_STORE_URL — App Store listing URL
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEFAULT_APP_STORE_URL =
  "https://apps.apple.com/us/app/gain-gang/id6792023328";
const APP_SCHEME = "gaingang";

function parseInviteCode(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("code")?.trim().toUpperCase();
  if (fromQuery) return fromQuery;

  const parts = url.pathname.split("/").filter(Boolean);
  const inviteIdx = parts.findIndex((part) => part === "invite");
  const fromPath =
    inviteIdx >= 0 ? parts[inviteIdx + 1]?.trim().toUpperCase() : undefined;
  return fromPath && fromPath.length > 0 ? fromPath : null;
}

Deno.serve((req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const storeUrl =
    Deno.env.get("APP_STORE_URL")?.trim() || DEFAULT_APP_STORE_URL;

  // Explicit store fallback (linked from SMS for people without the app).
  if (url.searchParams.get("store") === "1") {
    return Response.redirect(storeUrl, 302);
  }

  const code = parseInviteCode(req);
  if (!code) {
    return new Response(
      `Missing invite code.\n\nGet GainGang: ${storeUrl}`,
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }

  const deepLink = `${APP_SCHEME}://invite/${encodeURIComponent(code)}`;
  const body = [
    "Opening GainGang…",
    "",
    `If the app didn't open, tap Open GainGang: ${deepLink}`,
    `Or download it: ${storeUrl}`,
  ].join("\n");

  // 302 to the custom scheme opens the app when installed (iOS/Android).
  // Plain-text body + Refresh cover clients that don't follow the Location.
  return new Response(req.method === "HEAD" ? null : body, {
    status: 302,
    headers: {
      Location: deepLink,
      Refresh: `0;url=${deepLink}`,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
