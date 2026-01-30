import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "../api/songs";
import { useUpdateSong } from "../hooks/useSongs";
import { useDeleteSong } from "../hooks/useDeleteSong";
import { useAddSongToPlaylist, usePlaylists, useRemoveSongFromPlaylist } from "../hooks/usePlaylists";
import { useInfiniteSongs } from "../hooks/useInfiniteSongs";
import { useCoverPreview } from "../hooks/useCoverPreview";
import { CoverModal } from "./CoverModal";
import { SharePlaylistModal } from "./SharePlaylistModal";
import { SongRow } from "./SongRow";
import { SortableTh } from "./SortableTh";

export function SongsTable({ playlistId }: { playlistId: string | null }) {
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "artist" | "tuning" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [shareOpen, setShareOpen] = useState(false);

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

  const cover = useCoverPreview();

  const selectedPlaylistName = useMemo(() => {
    if (!playlistId) return null;
    return (playlists ?? []).find((p) => p.id === playlistId)?.name ?? "Playlist";
  }, [playlistId, playlists]);

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

  useEffect(() => {
    if (playlistId) return;
    setShareOpen(false);
  }, [playlistId]);

  if (inf.isLoading) return <div style={{ marginTop: 16 }}>Loading songs…</div>;
  if (inf.error) return <pre style={{ marginTop: 16 }}>{String(inf.error)}</pre>;

  return (
    <>
      <div style={{ marginTop: 16 }} className="fade-in">
        {playlistId ? (
          <div className="row" style={{ gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: 30, opacity: 0.95 }}>{selectedPlaylistName}</div>
            <div style={{ flex: 1 }} />
            <button className="btn" type="button" onClick={() => setShareOpen(true)}>
              🔗 Share
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 10, opacity: 0.75, fontSize: 13 }}>All songs</div>
        )}

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
                rows.map((s: Song) => (
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
                    onOpenCover={() => cover.openCover(s)}
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

      <CoverModal open={cover.open} src={cover.src} title={cover.title} loading={cover.loading} onClose={cover.close} />

      <SharePlaylistModal open={shareOpen} playlistId={playlistId} onClose={() => setShareOpen(false)} />
    </>
  );
}
