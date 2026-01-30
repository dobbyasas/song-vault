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

  if (gotArtist === wantArtist) score += 80;
  else if (gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist)) score += 50;

  if (gotName === wantName) score += 70;
  else if (gotName.includes(wantName) || wantName.includes(gotName)) score += 40;

  const bad = ["karaoke", "tribute", "cover", "instrumental", "made famous by", "version"];
  const meta = `${gotName} ${gotArtist}`;
  if (bad.some((w) => meta.includes(w))) score -= 60;

  return score;
}

function toHqArtwork(url100: string) {
  return url100.replace(/100x100bb\.(jpg|png)$/i, "1000x1000bb.$1");
}

async function fetchHqCoverFromITunes(name: string, artist: string, signal?: AbortSignal) {
  const term = encodeURIComponent(`${artist} ${name}`);
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=25`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;

  const data = (await res.json()) as any;
  const results: any[] = data?.results ?? [];
  if (!results.length) return null;

  const strongArtist = results.filter((r) => artistMatches(r?.artistName ?? "", artist));
  const pool = strongArtist.length ? strongArtist : results;

  let best: any = null;
  let bestScore = -999;

  for (const hit of pool) {
    const s = scoreHit(hit, name, artist);
    if (s > bestScore) {
      bestScore = s;
      best = hit;
    }
  }

  if (!best) return null;

  const art100: string | undefined = best?.artworkUrl100;
  if (!art100) return null;

  return toHqArtwork(art100);
}

function isEmptyImageUrl(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return true;
  if (s.startsWith("data:image/")) return true;
  return false;
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
  image_url: string | null;
  created_at: string;
};

async function main() {
  const pageSize = 200;

  let scanned = 0;
  let missing = 0;
  let updated = 0;
  let failures = 0;

  let lastCreatedAt: string | null = null;
  let lastId: string | null = null;

  process.stdout.write("Backfilling covers for ALL songs (only missing will be updated)…\n\n");

  while (true) {
    let query = supabase
      .from("songs")
      .select("id,name,artist,image_url,created_at")
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
      scanned++;

      if (!isEmptyImageUrl(s.image_url)) continue;
      missing++;

      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 8000);

      try {
        const hq = await fetchHqCoverFromITunes(s.name, s.artist, ac.signal);
        if (!hq) {
          failures++;
          process.stdout.write(`× no match: ${s.artist} — ${s.name}\n`);
          continue;
        }

        const { error: uErr } = await supabase.from("songs").update({ image_url: hq }).eq("id", s.id);
        if (uErr) throw uErr;

        updated++;
        process.stdout.write(`✓ updated: ${s.artist} — ${s.name}\n`);
      } catch (e: any) {
        failures++;
        process.stdout.write(`× error: ${s.artist} — ${s.name} (${e?.name ?? "error"})\n`);
      } finally {
        clearTimeout(timeout);
        await sleep(220);
      }
    }

    const last = page[page.length - 1]!;
    lastCreatedAt = last.created_at;
    lastId = last.id;

    process.stdout.write(
      `\nProgress: scanned=${scanned} missing=${missing} updated=${updated} failures=${failures}\n\n`
    );
    await sleep(200);
  }

  process.stdout.write(
    `Done.\nscanned=${scanned}\nmissing=${missing}\nupdated=${updated}\nfailures=${failures}\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
