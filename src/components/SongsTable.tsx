import { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "../api/songs";
import { useUpdateSong } from "../hooks/useSongs";
import { useDeleteSong } from "../hooks/useDeleteSong";
import { useAddSongToPlaylist, usePlaylists, useRemoveSongFromPlaylist } from "../hooks/usePlaylists";
import { useInfiniteSongs } from "../hooks/useInfiniteSongs";
import { useCoverPreview } from "../hooks/useCoverPreview";
import { useTunings } from "../hooks/useTunings";
import { CoverModal } from "./CoverModal";
import { SharePlaylistModal } from "./SharePlaylistModal";
import { SongRow } from "./SongRow";
import { SortableTh } from "./SortableTh";

function formatTotalDurationMs(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function SongsTable({ playlistId }: { playlistId: string | null }) {
  const [q, setQ] = useState("");
  const [tuningFilter, setTuningFilter] = useState<string>("__ALL__");
  const [sortBy, setSortBy] = useState<"name" | "artist" | "tuning" | "created_at" | "duration_ms">("created_at");
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
  const tunings = useTunings();

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

  const filteredRows = useMemo(() => {
    if (tuningFilter === "__ALL__") return rows;
    return rows.filter((r) => (r.tuning ?? "").trim() === tuningFilter);
  }, [rows, tuningFilter]);

  const totalCount = inf.data?.pages?.[0]?.count ?? 0;

  const totalDurationMs = useMemo(() => {
    let sum = 0;
    for (const s of filteredRows as any[]) {
      const ms = s?.duration_ms;
      if (typeof ms === "number" && isFinite(ms) && ms > 0) sum += ms;
    }
    return sum;
  }, [filteredRows]);

  const totalDurationLabel = useMemo(() => {
    if (!filteredRows.length) return "";
    return formatTotalDurationMs(totalDurationMs);
  }, [filteredRows.length, totalDurationMs]);

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
    if (field === sortBy) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      if (field === "created_at") setSortDir("desc");
      else if (field === "duration_ms") setSortDir("desc");
      else setSortDir("asc");
    }
  }

  useEffect(() => {
    if (playlistId) return;
    setShareOpen(false);
  }, [playlistId]);

  const showInitialLoading = inf.isLoading && filteredRows.length === 0 && !inf.error;

  return (
    <>
      <div style={{ marginTop: 16 }} className="fade-in">
        {playlistId ? (
          <div className="row" style={{ gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 800, fontSize: 14, opacity: 0.95 }}>{selectedPlaylistName}</div>
            <span className="badge" style={{ opacity: 0.9 }}>
              playlist
            </span>
            <div style={{ flex: 1 }} />
            <button className="btn" type="button" onClick={() => setShareOpen(true)}>
              Share
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
            style={{ flex: 1, minWidth: 220 }}
          />

          <select
            className="input"
            value={tuningFilter}
            onChange={(e) => setTuningFilter(e.target.value)}
            style={{ width: 180 }}
            title="Filter by tuning"
          >
            <option value="__ALL__">All tunings</option>
            {(tunings.data ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <span className="badge">
            {inf.isFetching && !inf.isFetchingNextPage ? "Refreshing…" : `${filteredRows.length}/${totalCount}`}
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
                <SortableTh label="Length" active={sortBy === "duration_ms"} dir={sortDir} onClick={() => toggleSort("duration_ms")}/>
                <th className="th" style={{ width: 64 }} />
              </tr>
            </thead>

            <tbody className="tbody">
              {inf.error ? (
                <tr>
                  <td className="td" colSpan={6} style={{ padding: 16, color: "crimson", opacity: 0.9 }}>
                    {String(inf.error)}
                  </td>
                </tr>
              ) : showInitialLoading ? (
                <tr>
                  <td className="td" colSpan={6} style={{ padding: 16, opacity: 0.75 }}>
                    Loading songs…
                  </td>
                </tr>
              ) : filteredRows.length ? (
                filteredRows.map((s: Song) => (
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

          {!inf.hasNextPage && filteredRows.length > 0 && (
            <div style={{ padding: 12, opacity: 0.7, fontSize: 13, display: "flex", justifyContent: "flex-end" }}>
              <span className="badge" title="Total duration">
                Total: {totalDurationLabel}
              </span>
            </div>
          )}
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
