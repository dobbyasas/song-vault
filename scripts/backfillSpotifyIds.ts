import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

function norm(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSpotifyTrack(track: any, wantName: string, wantArtist: string) {
  const gotName = norm(track?.name ?? "");
  const gotArtists = (track?.artists ?? []).map((a: any) => norm(a?.name ?? "")).filter(Boolean);
  const gotArtist = gotArtists[0] ?? "";

  const wn = norm(wantName);
  const wa = norm(wantArtist);

  if (!gotName || !gotArtists.length || !wn || !wa) return -999;

  let score = 0;

  if (gotArtists.includes(wa)) score += 90;
  else if (gotArtists.some((a: string) => a.includes(wa) || wa.includes(a))) score += 55;

  if (gotName === wn) score += 80;
  else if (gotName.includes(wn) || wn.includes(gotName)) score += 45;

  const bad = ["karaoke", "tribute", "cover", "instrumental", "made famous by", "version", "8d", "sped up", "slowed"];
  const meta = `${gotName} ${gotArtists.join(" ")}`;
  if (bad.some((w) => meta.includes(w))) score -= 80;

  const isExplicit = track?.explicit === true;
  if (isExplicit) score += 2;

  const popularity = typeof track?.popularity === "number" ? track.popularity : 0;
  score += Math.min(10, Math.floor(popularity / 10));

  return score;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL)");
if (!SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
if (!SPOTIFY_CLIENT_ID) throw new Error("Missing SPOTIFY_CLIENT_ID");
if (!SPOTIFY_CLIENT_SECRET) throw new Error("Missing SPOTIFY_CLIENT_SECRET");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getSpotifyToken() {
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`);
  const json = (await res.json()) as any;
  const token = String(json?.access_token ?? "");
  if (!token) throw new Error("Spotify token missing access_token");
  return token;
}

async function spotifySearchTrack(q: string, token: string, signal?: AbortSignal) {
  const url = `https://api.spotify.com/v1/search?type=track&limit=20&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  return (json?.tracks?.items ?? []) as any[];
}

async function findBestSpotifyTrackId(name: string, artist: string, token: string, signal?: AbortSignal) {
  const queries = [
    `track:${name} artist:${artist}`,
    `${artist} ${name}`,
    `${name} ${artist}`,
    `${name}`,
  ];

  let best: any = null;
  let bestScore = -999;

  for (const q of queries) {
    const items = await spotifySearchTrack(q, token, signal);
    for (const t of items) {
      const s = scoreSpotifyTrack(t, name, artist);
      if (s > bestScore) {
        bestScore = s;
        best = t;
      }
    }
    if (best && bestScore >= 120) break;
  }

  const id = best?.id;
  if (!id || typeof id !== "string") return null;

  return { id, score: bestScore, pickedName: best?.name ?? "", pickedArtist: best?.artists?.[0]?.name ?? "" };
}

type SongLite = {
  id: string;
  name: string;
  artist: string;
  spotify_id: string | null;
  created_at: string;
};

async function main() {
  const token = await getSpotifyToken();
  process.stdout.write("Spotify token: OK\n\n");

  const pageSize = 200;

  let missing = 0;
  let updated = 0;
  let failures = 0;

  let lastCreatedAt: string | null = null;
  let lastId: string | null = null;

  process.stdout.write("Backfilling spotify_id for ALL songs (only missing will be updated)…\n\n");

  while (true) {
    let query = supabase
      .from("songs")
      .select("id,name,artist,spotify_id,created_at")
      .is("spotify_id", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(pageSize);

    if (lastCreatedAt && lastId) {
      query = query.or(`created_at.gt.${lastCreatedAt},and(created_at.eq.${lastCreatedAt},id.gt.${lastId})`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = (data ?? []) as SongLite[];
    if (page.length === 0) break;

    for (const s of page) {
      missing++;

      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 15000);

      try {
        const hit = await findBestSpotifyTrackId(s.name, s.artist, token, ac.signal);
        if (!hit) {
          failures++;
          process.stdout.write(`× no match: ${s.artist} — ${s.name}\n`);
          continue;
        }

        const { error: uErr } = await supabase.from("songs").update({ spotify_id: hit.id }).eq("id", s.id);
        if (uErr) throw uErr;

        updated++;
        process.stdout.write(`✓ ${s.artist} — ${s.name} -> ${hit.pickedArtist} — ${hit.pickedName}\n`);
      } catch (e: any) {
        failures++;
        process.stdout.write(`× error: ${s.artist} — ${s.name} (${e?.name ?? "error"})\n`);
      } finally {
        clearTimeout(timeout);
        await sleep(120);
      }
    }

    const last = page[page.length - 1]!;
    lastCreatedAt = last.created_at;
    lastId = last.id;

    process.stdout.write(`\nProgress: missing=${missing} updated=${updated} failures=${failures}\n\n`);
    await sleep(200);
  }

  if (missing === 0) process.stdout.write("Nothing to do: no songs with spotify_id = NULL.\n");
  else process.stdout.write(`Done.\nmissing=${missing}\nupdated=${updated}\nfailures=${failures}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
