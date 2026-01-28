// supabase/functions/resolve_spotify/index.ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function withCors(res: Response) {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

function json(body: any, status = 200) {
  return withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

async function getSpotifyToken() {
  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Missing SPOTIFY_CLIENT_ID/SECRET");

  const basic = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Spotify token error: ${res.status} ${text}`);

  const data = JSON.parse(text);
  return data.access_token as string;
}

function pickBestImage(images: any[]) {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const medium =
    sorted.find((img) => (img.width ?? 0) >= 250) ??
    sorted[Math.floor(sorted.length / 2)];
  return medium?.url ?? sorted[sorted.length - 1]?.url ?? null;
}

Deno.serve(async (req) => {
  // ALWAYS handle CORS preflight first and return WITHOUT touching the body
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  // Only POST is supported
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // Safe body parsing (never throws uncaught)
    let payload: any = {};
    const raw = await req.text();
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
    } else {
      return json({ error: "Missing JSON body" }, 400);
    }

    const { song_id, name, artist } = payload;
    if (!song_id || !name || !artist) {
      return json({ error: "song_id, name, artist required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = await getSpotifyToken();

    const q = `track:${name} artist:${artist}`;
    const searchUrl = new URL("https://api.spotify.com/v1/search");
    searchUrl.searchParams.set("type", "track");
    searchUrl.searchParams.set("limit", "5");
    searchUrl.searchParams.set("q", q);

    const sres = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    const stext = await sres.text();
    if (!sres.ok) throw new Error(`Spotify search error: ${sres.status} ${stext}`);

    const sdata = JSON.parse(stext);
    const items = sdata?.tracks?.items ?? [];
    if (items.length === 0) return json({ ok: true, matched: false });

    const best = items[0];
    const spotify_id = best?.id ?? null;
    const image_url = pickBestImage(best?.album?.images ?? null);

    console.log("Resolved:", { song_id, name, artist, spotify_id, image_url });

    const { error } = await admin
      .from("songs")
      .update({ spotify_id, image_url })
      .eq("id", song_id);

    if (error) throw new Error(`DB update error: ${error.message}`);

    return json({ ok: true, matched: true, spotify_id, image_url });
  } catch (e: any) {
    console.error("resolve_spotify error:", e?.message ?? String(e));
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
