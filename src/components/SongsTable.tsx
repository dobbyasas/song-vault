import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "../api/songs";
import { useUpdateSong } from "../hooks/useSongs";
import { useDeleteSong } from "../hooks/useDeleteSong";
import { useAddSongToPlaylist, usePlaylists, useRemoveSongFromPlaylist } from "../hooks/usePlaylists";
import { useInfiniteSongs } from "../hooks/useInfiniteSongs";

const FALLBACK_COVER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#a855f7" offset="0"/>
        <stop stop-color="#06060a" offset="1"/>
      </linearGradient>
    </defs>
    <rect width="56" height="56" rx="12" fill="url(#g)"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
      font-family="ui-monospace, Menlo, Consolas" font-size="20" fill="rgba(255,255,255,.85)">♪</text>
  </svg>
`);

type PlaylistLite = { id: string; name: string };

export function SongsTable({ playlistId }: { playlistId: string | null }) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "artist" | "tuning" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  function toggleSort(field: typeof sortBy) {
    if (field === sortBy) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setSortDir(field === "created_at" ? "desc" : "asc");
    }
  }

  if (inf.isLoading) return <div style={{ marginTop: 16 }}>Loading songs…</div>;
  if (inf.error) return <pre style={{ marginTop: 16 }}>{String(inf.error)}</pre>;

  return (
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
              <th className="th" style={{ width: 72, cursor: "default" }}>
                Art
              </th>
              <SortableTh label="Song" active={sortBy === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              <SortableTh label="Artist" active={sortBy === "artist"} dir={sortDir} onClick={() => toggleSort("artist")} />
              <SortableTh label="Tuning" active={sortBy === "tuning"} dir={sortDir} onClick={() => toggleSort("tuning")} />
              <SortableTh label="Added" active={sortBy === "created_at"} dir={sortDir} onClick={() => toggleSort("created_at")} />
              <th className="th" style={{ width: 64, cursor: "default" }} />
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
        <div style={{ position: "relative", width: 56, height: 56 }}>
          <img src={song.image_url || FALLBACK_COVER} width={56} height={56} loading="lazy" decoding="async" className="cover" />
          {!song.image_url && (
            <div
              className="pulse"
              title="Matching Spotify…"
              style={{ position: "absolute", inset: -6, borderRadius: 16, pointerEvents: "none", opacity: 0.85 }}
            />
          )}
        </div>
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
              className="btn btn-ghost"
              title="More"
              onClick={() => {
                setMenuOpen((v) => !v);
                setAddOpen(false);
              }}
              style={{ width: 42 }}
            >
              ⋯
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
