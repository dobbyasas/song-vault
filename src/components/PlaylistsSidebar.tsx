import { useMemo, useState } from "react";
import { useCreatePlaylist, useDeletePlaylist, usePlaylists } from "../hooks/usePlaylists";

export function PlaylistsSidebar({
  userId,
  selectedPlaylistId,
  onSelect,
}: {
  userId: string;
  selectedPlaylistId: string | null;
  onSelect: (playlistId: string | null) => void;
}) {
  const { data: playlists, isLoading, error } = usePlaylists();
  const createPl = useCreatePlaylist();
  const delPl = useDeletePlaylist();

  const [name, setName] = useState("");

  const items = useMemo(() => playlists ?? [], [playlists]);

  function submitQuick() {
    const n = name.trim();
    if (!n) return;
    createPl.mutate(
      { user_id: userId, name: n, description: null },
      {
        onSuccess: (p) => {
          setName("");
          onSelect(p.id);
        },
      }
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-title">Playlists</div>

        <div className="sidebar-new">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Quick create…"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitQuick();
            }}
          />
          <button className="btn" onClick={submitQuick} disabled={createPl.isPending || !name.trim()}>
            +
          </button>
        </div>
      </div>

      <div className="sidebar-body">
        <button
          className={`sidebar-item ${selectedPlaylistId === null ? "active" : ""}`}
          onClick={() => onSelect(null)}
        >
          <span>All songs</span>
        </button>

        <div className="sidebar-sep" />

        {isLoading ? (
          <div className="sidebar-muted">Loading…</div>
        ) : error ? (
          <div className="sidebar-muted">{String(error)}</div>
        ) : items.length ? (
          items.map((p) => (
            <div key={p.id} className={`sidebar-row ${selectedPlaylistId === p.id ? "active" : ""}`}>
              <button className="sidebar-item" onClick={() => onSelect(p.id)} title={p.name}>
                <span className="ellipsis">{p.name}</span>
              </button>

              <button
                className="kebab"
                title="Delete playlist"
                onClick={() => {
                  const ok = confirm(
                    `Delete playlist "${p.name}"?\nThis removes the playlist (and its song links), not the songs themselves.`
                  );
                  if (!ok) return;
                  delPl.mutate(p.id, { onSuccess: () => onSelect(null) });
                }}
                disabled={delPl.isPending}
              >
                🗑
              </button>
            </div>
          ))
        ) : (
          <div className="sidebar-muted">No playlists yet.</div>
        )}
      </div>
    </aside>
  );
}
