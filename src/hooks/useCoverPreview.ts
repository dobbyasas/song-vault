import { useEffect, useRef, useState } from "react";
import type { Song } from "../api/songs";
import { fetchHqCoverFromITunes } from "../utils/itunesCover";

const FALLBACK_COVER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#a855f7" offset="0"/>
        <stop stop-color="#06060a" offset="1"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" rx="64" fill="url(#g)"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
      font-family="ui-monospace, Menlo, Consolas" font-size="140" fill="rgba(255,255,255,.85)">♪</text>
  </svg>
`);

export function useCoverPreview() {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<string>(FALLBACK_COVER);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const reqRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      reqRef.current?.abort();
    };
  }, []);

  function close() {
    reqRef.current?.abort();
    reqRef.current = null;
    setLoading(false);
    setOpen(false);
  }

  async function openCover(song: Song) {
    const key = song.id;

    setTitle(`${song.name} — ${song.artist}`);
    setSrc(song.image_url || FALLBACK_COVER);
    setOpen(true);

    const cached = cacheRef.current.get(key);
    if (cached) {
      setSrc(cached);
      return;
    }

    reqRef.current?.abort();
    const ac = new AbortController();
    reqRef.current = ac;

    setLoading(true);
    try {
      const hq = await fetchHqCoverFromITunes(song.name, song.artist, ac.signal);
      if (!hq) return;
      cacheRef.current.set(key, hq);
      setSrc(hq);
    } catch (e: any) {
    } finally {
      setLoading(false);
    }
  }

  return {
    open,
    src,
    title,
    loading,
    openCover,
    close,
  };
}
