import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
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

  if (!res.ok) throw new Error(`Spotify token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

function pickBestImage(images: any[]) {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const medium = sorted.find((img) => (img.width ?? 0) >= 250) ?? sorted[Math.floor(sorted.length / 2)];
  return medium?.url ?? sorted[sorted.length - 1]?.url ?? null;
}

Deno.serve(async (req) => {
  try {
    const { song_id, name, artist } = await req.json();
    if (!song_id || !name || !artist) return json({ error: "song_id, name, artist required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const token = await getSpotifyToken();

    const q = `track:${name} artist:${artist}`;
    const searchUrl = new URL("https://api.spotify.com/v1/search");
    searchUrl.searchParams.set("type", "track");
    searchUrl.searchParams.set("limit", "5");
    searchUrl.searchParams.set("q", q);

    const sres = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!sres.ok) throw new Error(`Spotify search error: ${sres.status} ${await sres.text()}`);
    const sdata = await sres.json();

    const items = sdata?.tracks?.items ?? [];
    if (items.length === 0) return json({ ok: true, matched: false });

    const best = items[0];
    const spotify_id = best?.id ?? null;
    const image_url = pickBestImage(best?.album?.images ?? null);

    const { error } = await admin
      .from("songs")
      .update({
        spotify_id,
        image_url,
        image_updated_at: new Date().toISOString(),
      })
      .eq("id", song_id);

    if (error) throw error;

    return json({ ok: true, matched: true, spotify_id, image_url });
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
