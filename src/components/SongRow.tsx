import { useEffect, useRef, useState } from "react";
import type { Song } from "../api/songs";

type PlaylistLite = { id: string; name: string };

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

export function SongRow({
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
      <td className="td">
        {edit ? <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} /> : song.artist}
      </td>
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
