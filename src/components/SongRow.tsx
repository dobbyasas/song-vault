import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

type MenuPos = { top: number; left: number; minWidth: number };
type SubmenuPos = { top: number; left: number; minWidth: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function SongRow({
  song,
  currentPlaylistId,
  playlists,
  onSave,
  onDelete,
  onAddToPlaylist,
  onOpenCover,
  onSharePlaylist,
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
  onSharePlaylist?: () => void;
  saving: boolean;
  deleting: boolean;
  adding: boolean;
}) {
  const [edit, setEdit] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuPos, setSubmenuPos] = useState<SubmenuPos | null>(null);

  const kebabRef = useRef<HTMLButtonElement | null>(null);
  const menuElRef = useRef<HTMLDivElement | null>(null);
  const submenuElRef = useRef<HTMLDivElement | null>(null);
  const addItemRef = useRef<HTMLButtonElement | null>(null);

  const closeTimerRef = useRef<number | null>(null);

  const [name, setName] = useState(song.name);
  const [artist, setArtist] = useState(song.artist);
  const [tuning, setTuning] = useState(song.tuning ?? "");

  const deleteLabel = currentPlaylistId ? "Remove from playlist" : "Delete song";
  const deleteConfirm = currentPlaylistId
    ? `Remove "${song.name}" from this playlist?`
    : `Delete "${song.name}" permanently?`;

  const canSave = name.trim().length > 0 && artist.trim().length > 0;

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function scheduleCloseAll() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeMenu();
      closeTimerRef.current = null;
    }, 160);
  }

  function closeMenu() {
    clearCloseTimer();
    setMenuOpen(false);
    setMenuPos(null);
    setSubmenuOpen(false);
    setSubmenuPos(null);
  }

  function startEdit() {
    setName(song.name);
    setArtist(song.artist);
    setTuning(song.tuning ?? "");
    setEdit(true);
    closeMenu();
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

  function computeAndOpenMenu() {
    const btn = kebabRef.current;
    if (!btn) return;

    const r = btn.getBoundingClientRect();
    const gap = 8;

    setMenuPos({
      top: r.bottom + gap,
      left: Math.max(gap, r.right - 220),
      minWidth: 220,
    });

    setMenuOpen(true);
    setSubmenuOpen(false);
    setSubmenuPos(null);
  }

  function computeSubmenuPos() {
    const anchor = addItemRef.current;
    const menu = menuElRef.current;
    if (!anchor || !menu) return;

    const a = anchor.getBoundingClientRect();
    const m = menu.getBoundingClientRect();

    const gap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = 260;

    const preferredLeft = m.right + gap;
    const canRight = preferredLeft + width <= vw - gap;
    const left = canRight ? preferredLeft : clamp(m.left - gap - width, gap, vw - width - gap);

    const minHeightGuess = 160;
    const top = clamp(a.top, gap, vh - minHeightGuess - gap);

    setSubmenuPos({ left, top, minWidth: width });
  }

  function openSubmenu() {
    clearCloseTimer();
    setSubmenuOpen(true);
    computeSubmenuPos();
    requestAnimationFrame(() => computeSubmenuPos());
  }

  useEffect(() => {
    if (!menuOpen) return;

    const onDocDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (kebabRef.current?.contains(t)) return;
      if (menuElRef.current?.contains(t)) return;
      if (submenuElRef.current?.contains(t)) return;
      closeMenu();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    const onResizeOrScroll = () => {
      requestAnimationFrame(() => {
        if (!menuOpen) return;

        const btn = kebabRef.current;
        const menu = menuElRef.current;
        if (!btn || !menu) return;

        const r = btn.getBoundingClientRect();
        const m = menu.getBoundingClientRect();

        const gap = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const fitsBelow = r.bottom + gap + m.height <= vh;
        const top = clamp(fitsBelow ? r.bottom + gap : r.top - gap - m.height, gap, vh - m.height - gap);

        let left = r.right - m.width;
        left = clamp(left, gap, vw - m.width - gap);

        setMenuPos({ top, left, minWidth: 220 });

        if (submenuOpen) computeSubmenuPos();
      });
    };

    document.addEventListener("pointerdown", onDocDown, { capture: true });
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    return () => {
      document.removeEventListener("pointerdown", onDocDown, { capture: true } as any);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [menuOpen, submenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const raf = requestAnimationFrame(() => {
      const btn = kebabRef.current;
      const menu = menuElRef.current;
      if (!btn || !menu) return;

      const r = btn.getBoundingClientRect();
      const m = menu.getBoundingClientRect();

      const gap = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const fitsBelow = r.bottom + gap + m.height <= vh;
      const top = clamp(fitsBelow ? r.bottom + gap : r.top - gap - m.height, gap, vh - m.height - gap);

      let left = r.right - m.width;
      left = clamp(left, gap, vw - m.width - gap);

      setMenuPos((prev) => {
        if (!prev) return { top, left, minWidth: 220 };
        if (Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5) return prev;
        return { ...prev, top, left };
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [menuOpen]);

  const portalMenus = useMemo(() => {
    if (!menuOpen || !menuPos) return null;

    const menuStyle: React.CSSProperties = {
      position: "fixed",
      left: menuPos.left,
      top: menuPos.top,
      minWidth: menuPos.minWidth,
      zIndex: 99999,
      background: "rgba(10, 6, 18, 0.92)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      boxShadow: "0 22px 70px rgba(0,0,0,0.62)",
      backdropFilter: "blur(12px)",
      overflowX: "hidden",
      overflowY: "auto",
      maxHeight: "70vh",
    };

    const submenuStyle: React.CSSProperties | undefined =
      submenuOpen && submenuPos
        ? {
            position: "fixed",
            left: submenuPos.left,
            top: submenuPos.top,
            minWidth: submenuPos.minWidth,
            zIndex: 100000,
            background: "rgba(10, 6, 18, 0.96)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 22px 70px rgba(0,0,0,0.62)",
            backdropFilter: "blur(12px)",
            overflowX: "hidden",
            overflowY: "auto",
            maxHeight: "70vh",
          }
        : undefined;

    const stop = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
    };

    return createPortal(
      <>
        <div
          ref={menuElRef}
          className="menu"
          style={menuStyle}
          onPointerDown={stop}
          onClick={stop}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleCloseAll}
        >
          <button className="menu-item" onClick={startEdit}>
            Edit
          </button>

          {!currentPlaylistId && (
            <button
              ref={addItemRef}
              className="menu-item"
              onMouseEnter={openSubmenu}
              onClick={() => {
                if (submenuOpen) {
                  setSubmenuOpen(false);
                  setSubmenuPos(null);
                } else {
                  openSubmenu();
                }
              }}
              onFocus={openSubmenu}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
            >
              <span>Add to playlist</span>
              <span style={{ opacity: 0.7 }}>▸</span>
            </button>
          )}

          {currentPlaylistId && onSharePlaylist && (
            <button
              className="menu-item"
              onClick={() => {
                closeMenu();
                onSharePlaylist();
              }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              title="Share this playlist (read-only link)"
            >
              <span>Share playlist</span>
              <span style={{ opacity: 0.7 }}>🔗</span>
            </button>
          )}

          <button
            className="menu-item danger"
            onClick={() => {
              const ok = confirm(deleteConfirm);
              if (!ok) return;
              closeMenu();
              onDelete();
            }}
            disabled={deleting}
            title={deleteLabel}
          >
            {deleting ? "Working…" : deleteLabel}
          </button>
        </div>

        {submenuOpen && submenuPos && !currentPlaylistId && (
          <div
            ref={submenuElRef}
            className="submenu"
            style={submenuStyle}
            onPointerDown={stop}
            onClick={stop}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleCloseAll}
          >
            {playlists.length ? (
              playlists.map((p) => (
                <button
                  key={p.id}
                  className="menu-item"
                  onClick={() => {
                    onAddToPlaylist(p.id);
                    closeMenu();
                  }}
                  disabled={adding}
                  title={p.name}
                  style={{ width: "100%", textAlign: "left" }}
                >
                  {adding ? "Adding…" : p.name}
                </button>
              ))
            ) : (
              <div className="menu-item" style={{ opacity: 0.75, cursor: "default" }}>
                No playlists yet
              </div>
            )}
          </div>
        )}
      </>,
      document.body
    );
  }, [
    menuOpen,
    menuPos,
    submenuOpen,
    submenuPos,
    playlists,
    adding,
    deleting,
    deleteConfirm,
    deleteLabel,
    currentPlaylistId,
    onSharePlaylist,
  ]);

  return (
    <>
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
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                ref={kebabRef}
                className="kebab"
                title="More"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (menuOpen) closeMenu();
                  else computeAndOpenMenu();
                }}
              >
                ⋮
              </button>
            </div>
          )}
        </td>
      </tr>

      {portalMenus}
    </>
  );
}
