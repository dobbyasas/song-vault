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

export async function fetchHqCoverFromITunes(
  name: string,
  artist: string,
  signal: AbortSignal
): Promise<string | null> {
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

  return art100.replace(/100x100bb\.jpg$/, "1000x1000bb.jpg");
}
