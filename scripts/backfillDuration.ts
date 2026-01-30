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

function artistMatches(gotArtist: string, wantArtist: string) {
  const g = norm(gotArtist);
  const w = norm(wantArtist);
  if (!g || !w) return false;
  if (g === w) return true;
  if (g.includes(w) || w.includes(g)) return true;
  return false;
}

function scoreHit(hit: any, name: string, artist: string) {
  const wantName = norm(name);
  const wantArtist = norm(artist);

  const gotName = norm(hit?.trackName ?? "");
  const gotArtist = norm(hit?.artistName ?? "");

  let score = 0;
  if (!gotName || !gotArtist) return -999;

  if (gotArtist === wantArtist) score += 90;
  else if (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist)) score += 60;

  if (gotName === wantName) score += 80;
  else if (gotName.includes(wantName) || wantName.includes(gotName)) score += 50;

  const bad = ["karaoke", "tribute", "cover", "instrumental", "made famous by", "version"];
  const meta = `${gotName} ${gotArtist}`;
  if (bad.some((w) => meta.includes(w))) score -= 80;

  return score;
}

async function itunesSearch(term: string, signal?: AbortSignal) {
  const country = (process.env.ITUNES_COUNTRY || "US").toUpperCase();
  const q = encodeURIComponent(term);
  const url = `https://itunes.apple.com/search?term=${q}&entity=musicTrack&limit=200&country=${country}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  return (data?.results ?? []) as any[];
}

async function fetchDurationMsFromITunes(name: string, artist: string, signal?: AbortSignal) {
  const tries = [`${artist} ${name}`, `${name} ${artist}`, `${name}`];

  let best: any = null;
  let bestScore = -999;

  for (const t of tries) {
    const results = await itunesSearch(t, signal);
    for (const hit of results) {
      const s = scoreHit(hit, name, artist);
      if (s > bestScore) {
        bestScore = s;
        best = hit;
      }
    }
    if (best && bestScore >= 95) break;
  }

  const ms = best?.trackTimeMillis;
  if (typeof ms !== "number" || !isFinite(ms) || ms <= 0) return null;

  return Math.round(ms);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL)");
if (!SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type SongLite = {
  id: string;
  name: string;
  artist: string;
  spotify_id: string | null;
  duration_ms: number | null;
  created_at: string;
};

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function getSpotifyToken() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) return null;

  const json = (await res.json()) as any;
  const token = String(json?.access_token ?? "");
  return token ? token : null;
}

async function fetchSpotifyDurationMs(spotifyId: string, token: string, signal?: AbortSignal) {
  const res = await fetch(`https://api.spotify.com/v1/tracks/${encodeURIComponent(spotifyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const ms = data?.duration_ms;
  if (typeof ms !== "number" || !isFinite(ms) || ms <= 0) return null;
  return Math.round(ms);
}

async function main() {
  const pageSize = 200;

  let missing = 0;
  let updated = 0;
  let failures = 0;

  let lastCreatedAt: string | null = null;
  let lastId: string | null = null;

  const spotifyToken = await getSpotifyToken();
  if (!spotifyToken) {
    process.stdout.write("Spotify token: not available (set SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET to enable)\n\n");
  } else {
    process.stdout.write("Spotify token: OK (Spotify-first enabled)\n\n");
  }

  process.stdout.write("Backfilling duration_ms for ALL songs (only missing will be updated)…\n\n");

  while (true) {
    let query = supabase
      .from("songs")
      .select("id,name,artist,spotify_id,duration_ms,created_at")
      .is("duration_ms", null)
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
        let ms: number | null = null;

        if (spotifyToken && s.spotify_id) {
          ms = await fetchSpotifyDurationMs(s.spotify_id, spotifyToken, ac.signal);
        }

        if (!ms) {
          ms = await fetchDurationMsFromITunes(s.name, s.artist, ac.signal);
        }

        if (!ms) {
          failures++;
          process.stdout.write(`× no match: ${s.artist} — ${s.name}\n`);
          continue;
        }

        const { error: uErr } = await supabase.from("songs").update({ duration_ms: ms }).eq("id", s.id);
        if (uErr) throw uErr;

        updated++;
        process.stdout.write(`✓ ${s.artist} — ${s.name} = ${Math.round(ms / 1000)}s\n`);
      } catch (e: any) {
        failures++;
        process.stdout.write(`× error: ${s.artist} — ${s.name} (${e?.name ?? "error"})\n`);
      } finally {
        clearTimeout(timeout);
        await sleep(160);
      }
    }

    const last = page[page.length - 1]!;
    lastCreatedAt = last.created_at;
    lastId = last.id;

    process.stdout.write(`\nProgress: missing=${missing} updated=${updated} failures=${failures}\n\n`);
    await sleep(200);
  }

  if (missing === 0) process.stdout.write("Nothing to do: no songs with duration_ms = NULL.\n");
  else process.stdout.write(`Done.\nmissing=${missing}\nupdated=${updated}\nfailures=${failures}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
