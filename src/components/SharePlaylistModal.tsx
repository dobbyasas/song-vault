import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDisablePlaylistShare, useEnablePlaylistShare, usePlaylistShareInfo } from "../hooks/usePlaylistShare";

export function SharePlaylistModal({
  open,
  playlistId,
  onClose,
}: {
  open: boolean;
  playlistId: string | null;
  onClose: () => void;
}) {
  const info = usePlaylistShareInfo(open ? playlistId : null);
  const enable = useEnablePlaylistShare();
  const disable = useDisablePlaylistShare();

  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const token = info.data?.share_token;
    const isPublic = info.data?.is_public;
    if (!token || !isPublic) return null;
    return `${window.location.origin}/share/playlist/${token}`;
  }, [info.data?.share_token, info.data?.is_public]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function copy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const working = info.isLoading || enable.isPending || disable.isPending;

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ display: "grid", placeItems: "center", padding: "2vh 2vw" }}
    >
      <div
        style={{
          width: "min(560px, 94vw)",
          borderRadius: 18,
          border: "1px solid var(--border)",
          background: "rgba(10, 6, 18, 0.92)",
          boxShadow: "0 22px 70px rgba(0,0,0,0.62)",
          backdropFilter: "blur(12px)",
          padding: 16,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Share playlist</div>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>
          Anyone with the link can view this playlist. They can’t edit it.
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!info.data?.is_public ? (
            <button className="btn" disabled={working || !playlistId} onClick={() => enable.mutate(playlistId!)}>
              {enable.isPending ? "Sharing…" : "Enable link"}
            </button>
          ) : (
            <>
              <button className="btn" disabled={working || !shareUrl} onClick={copy}>
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button className="btn btn-ghost" disabled={working || !playlistId} onClick={() => disable.mutate(playlistId!)}>
                {disable.isPending ? "Turning off…" : "Disable link"}
              </button>
            </>
          )}
        </div>

        {shareUrl && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "rgba(0,0,0,0.35)",
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={shareUrl}
          >
            {shareUrl}
          </div>
        )}

        {info.error && <div style={{ marginTop: 10, color: "crimson", fontSize: 13 }}>{String(info.error)}</div>}
      </div>
    </div>,
    document.body
  );
}
