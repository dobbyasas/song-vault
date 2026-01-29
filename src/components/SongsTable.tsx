import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Song } from "../api/songs";
import { useUpdateSong } from "../hooks/useSongs";
import { useDeleteSong } from "../hooks/useDeleteSong";
import { useAddSongToPlaylist, usePlaylists, useRemoveSongFromPlaylist } from "../hooks/usePlaylists";
import { useInfiniteSongs } from "../hooks/useInfiniteSongs";

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

type PlaylistLite = { id: string; name: string };

export function SongsTable({ playlistId }: { playlistId: string | null }) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "artist" | "tuning" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [coverOpen, setCoverOpen] = useState(false);
  const [coverSrc, setCoverSrc] = useState<string>(FALLBACK_COVER);
  const [coverTitle, setCoverTitle] = useState<string>("");
  const [coverLoading, setCoverLoading] = useState(false);

  const coverReqRef = useRef<AbortController | null>(null);
  const coverCacheRef = useRef<Map<string, string>>(new Map());

  const params = useMemo(
    () => ({
      q,
      sortBy,
      sortDir,
      limit: 50,
      playlistId,
    }),
    [q, sortBy, sortDir, playlistId]
  );

  const inf = useInfiniteSongs(params);
  const update = useUpdateSong();
  const delSong = useDeleteSong();
  const removeFromPlaylist = useRemoveSongFromPlaylist();
  const { data: playlists } = usePlaylists();
  const addToPl = useAddSongToPlaylist();

  const rows = useMemo(() => {
    const all = (inf.data?.pages ?? []).flatMap((p) => p.rows ?? []);
    const seen = new Set<string>();
    const unique: typeof all = [];
    for (const s of all) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      unique.push(s);
    }
    return unique;
  }, [inf.data]);

  const totalCount = inf.data?.pages?.[0]?.count ?? 0;

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && inf.hasNextPage && !inf.isFetchingNextPage) {
          inf.fetchNextPage();
        }
      },
      { root: null, rootMargin: "400px", threshold: 0 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [inf.hasNextPage, inf.isFetchingNextPage, inf.fetchNextPage]);

  useEffect(() => {
    if (!coverOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCover();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [coverOpen]);

  useEffect(() => {
    if (!coverOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [coverOpen]);

  useEffect(() => {
    return () => {
      coverReqRef.current?.abort();
    };
  }, []);

  function toggleSort(field: typeof sortBy) {
    if (field === sortBy) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setSortDir(field === "created_at" ? "desc" : "asc");
    }
  }

  function closeCover() {
    coverReqRef.current?.abort();
    coverReqRef.current = null;
    setCoverLoading(false);
    setCoverOpen(false);
  }

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

async function fetchHqCoverFromITunes(name: string, artist: string, signal: AbortSignal) {
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


  async function openCover(song: Song) {
    const key = song.id;

    setCoverTitle(`${song.name} — ${song.artist}`);
    setCoverSrc(song.image_url || FALLBACK_COVER);
    setCoverOpen(true);

    const cached = coverCacheRef.current.get(key);
    if (cached) {
      setCoverSrc(cached);
      return;
    }

    coverReqRef.current?.abort();
    const ac = new AbortController();
    coverReqRef.current = ac;

    setCoverLoading(true);
    try {
      const hq = await fetchHqCoverFromITunes(song.name, song.artist, ac.signal);
      if (!hq) return;
      coverCacheRef.current.set(key, hq);
      setCoverSrc(hq);
    } catch (e: any) {
      if (e?.name !== "AbortError") {
      }
    } finally {
      setCoverLoading(false);
    }
  }

  if (inf.isLoading) return <div style={{ marginTop: 16 }}>Loading songs…</div>;
  if (inf.error) return <pre style={{ marginTop: 16 }}>{String(inf.error)}</pre>;

  return (
    <>
      <div style={{ marginTop: 16 }} className="fade-in">
        <div className="row" style={{ gap: 12, alignItems: "center", marginBottom: 12 }}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by anything (song, artist, tuning)…"
            style={{ flex: 1 }}
          />
          <span className="badge">
            {inf.isFetching && !inf.isFetchingNextPage ? "Refreshing…" : `${rows.length}/${totalCount}`}
          </span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead className="thead">
              <tr>
                <th className="th" style={{ width: 72 }}>
                  Art
                </th>
                <SortableTh label="Song" active={sortBy === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                <SortableTh label="Artist" active={sortBy === "artist"} dir={sortDir} onClick={() => toggleSort("artist")} />
                <SortableTh label="Tuning" active={sortBy === "tuning"} dir={sortDir} onClick={() => toggleSort("tuning")} />
                <SortableTh
                  label="Added"
                  active={sortBy === "created_at"}
                  dir={sortDir}
                  onClick={() => toggleSort("created_at")}
                />
                <th className="th" style={{ width: 64 }} />
              </tr>
            </thead>

            <tbody className="tbody">
              {rows.length ? (
                rows.map((s) => (
                  <SongRow
                    key={s.id}
                    song={s}
                    currentPlaylistId={playlistId}
                    playlists={(playlists ?? []).map((p) => ({ id: p.id, name: p.name }))}
                    onSave={(patch) => update.mutate({ id: s.id, patch })}
                    onAddToPlaylist={(playlist_id) => addToPl.mutate({ playlist_id, song_id: s.id })}
                    onDelete={() => {
                      if (playlistId) removeFromPlaylist.mutate({ playlist_id: playlistId, song_id: s.id });
                      else delSong.mutate(s.id);
                    }}
                    onOpenCover={() => openCover(s)}
                    saving={update.isPending}
                    deleting={playlistId ? removeFromPlaylist.isPending : delSong.isPending}
                    adding={addToPl.isPending}
                  />
                ))
              ) : (
                <tr>
                  <td className="td" colSpan={6} style={{ padding: 16, opacity: 0.75 }}>
                    No songs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div ref={sentinelRef} style={{ height: 1 }} />

          {inf.isFetchingNextPage && <div style={{ padding: 12, opacity: 0.8, fontSize: 13 }}>Loading more…</div>}
          {!inf.hasNextPage && rows.length > 0 && <div style={{ padding: 12, opacity: 0.6, fontSize: 13 }}>End of list.</div>}
        </div>

        {(update.error || delSong.error || addToPl.error || removeFromPlaylist.error) && (
          <div style={{ color: "crimson", marginTop: 10, fontSize: 13 }}>
            {(update.error as any)?.message ??
              (removeFromPlaylist.error as any)?.message ??
              (delSong.error as any)?.message ??
              (addToPl.error as any)?.message ??
              "Operation failed"}
          </div>
        )}
      </div>

      {coverOpen &&
        createPortal(
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closeCover();
            }}
            style={{ display: "grid", placeItems: "center", padding: "2vh 2vw" }}
          >
            {coverLoading && (
              <div
                style={{
                  position: "fixed",
                  top: 14,
                  left: 14,
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "rgba(0,0,0,0.55)",
                  backdropFilter: "blur(10px)",
                  fontSize: 13,
                  opacity: 0.95,
                }}
              >
                Loading HQ…
              </div>
            )}

            <img
              src={coverSrc}
              alt={coverTitle}
              onClick={closeCover}
              style={{
                width: "100%",
                height: "100%",
                maxWidth: "100vw",
                maxHeight: "100vh",
                objectFit: "contain",
                cursor: "zoom-out",
                userSelect: "none",
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="th" onClick={onClick}>
      {label} {active ? (dir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}

function SongRow({
  song,
  currentPlaylistId,
  playlists,
  onSave,
  onDelete,
  onAddToPlaylist,
  onOpenCover,
  saving,
  deleting,
  adding,
}: {
  song: Song;
  currentPlaylistId: string | null;
  playlists: PlaylistLite[];
  onSave: (patch: Partial<Pick<Song, "name" | "artist" | "tuning">>) => void;
  onDelete: () => void;
  onAddToPlaylist: (playlistId: string) => void;
  onOpenCover: () => void;
  saving: boolean;
  deleting: boolean;
  adding: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState(song.name);
  const [artist, setArtist] = useState(song.artist);
  const [tuning, setTuning] = useState(song.tuning ?? "");

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(e.target as Node)) return;
      setMenuOpen(false);
      setAddOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function startEdit() {
    setName(song.name);
    setArtist(song.artist);
    setTuning(song.tuning ?? "");
    setEdit(true);
    setMenuOpen(false);
    setAddOpen(false);
  }

  function cancel() {
    setEdit(false);
  }

  function save() {
    onSave({
      name: name.trim(),
      artist: artist.trim(),
      tuning: tuning.trim() || null,
    });
    setEdit(false);
  }

  const canSave = name.trim().length > 0 && artist.trim().length > 0;

  const deleteLabel = currentPlaylistId ? "Remove from playlist" : "Delete song";
  const deleteConfirm = currentPlaylistId
    ? `Remove "${song.name}" from this playlist?`
    : `Delete "${song.name}" permanently?`;

  return (
    <tr className="tr">
      <td className="td">
        <button
          type="button"
          onClick={onOpenCover}
          title="View cover"
          style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer" }}
        >
          <div style={{ position: "relative", width: 56, height: 56 }}>
            <img
              src={song.image_url || FALLBACK_COVER}
              width={56}
              height={56}
              loading="lazy"
              decoding="async"
              className="cover"
              alt=""
            />
            {!song.image_url && (
              <div
                className="pulse"
                title="Matching Spotify…"
                style={{ position: "absolute", inset: -6, borderRadius: 16, pointerEvents: "none", opacity: 0.85 }}
              />
            )}
          </div>
        </button>
      </td>

      <td className="td">{edit ? <input className="input" value={name} onChange={(e) => setName(e.target.value)} /> : song.name}</td>
      <td className="td">{edit ? <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} /> : song.artist}</td>
      <td className="td">{edit ? <input className="input" value={tuning} onChange={(e) => setTuning(e.target.value)} /> : song.tuning ?? ""}</td>

      <td className="td" style={{ opacity: 0.75, fontSize: 13 }}>
        {new Date(song.created_at).toLocaleString()}
      </td>

      <td className="td" style={{ position: "relative", width: 64 }}>
        {edit ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn" disabled={!canSave || saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={cancel}>
              Cancel
            </button>
          </div>
        ) : (
          <div ref={menuRef} style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="kebab"
              title="More"
              onClick={() => {
                setMenuOpen((v) => !v);
                setAddOpen(false);
              }}
            >
              ⋮
            </button>

            {menuOpen && (
              <div className="menu">
                <button className="menu-item" onClick={startEdit}>
                  Edit
                </button>

                {!currentPlaylistId && (
                  <>
                    <button
                      className="menu-item"
                      onClick={() => setAddOpen((v) => !v)}
                      disabled={!playlists.length}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    >
                      <span>Add to playlist</span>
                      <span style={{ opacity: 0.7 }}>{addOpen ? "▾" : "▸"}</span>
                    </button>

                    {addOpen && (
                      <div className="submenu">
                        {playlists.map((p) => (
                          <button
                            key={p.id}
                            className="menu-item"
                            onClick={() => {
                              onAddToPlaylist(p.id);
                              setMenuOpen(false);
                              setAddOpen(false);
                            }}
                            disabled={adding}
                            title={p.name}
                          >
                            {adding ? "Adding…" : p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <button
                  className="menu-item danger"
                  onClick={() => {
                    const ok = confirm(deleteConfirm);
                    if (!ok) return;
                    setMenuOpen(false);
                    setAddOpen(false);
                    onDelete();
                  }}
                  disabled={deleting}
                  title={deleteLabel}
                >
                  {deleting ? "Working…" : deleteLabel}
                </button>
              </div>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
