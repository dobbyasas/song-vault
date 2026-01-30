import { useMemo, useState } from "react";
import { useDisablePlaylistShare, useEnablePlaylistShare, usePlaylistShareInfo } from "../hooks/usePlaylistShare";

export function SharePlaylistButton({ playlistId }: { playlistId: string }) {
  const [copied, setCopied] = useState(false);

  const info = usePlaylistShareInfo(playlistId);
  const enable = useEnablePlaylistShare();
  const disable = useDisablePlaylistShare();

  const shareUrl = useMemo(() => {
    const token = info.data?.share_token;
    const isPublic = info.data?.is_public;
    if (!token || !isPublic) return null;
    return `${window.location.origin}/share/playlist/${token}`;
  }, [info.data?.share_token, info.data?.is_public]);

  async function copy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const working = info.isLoading || enable.isPending || disable.isPending;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      {!info.data?.is_public ? (
        <button className="btn" disabled={working} onClick={() => enable.mutate(playlistId)}>
          {enable.isPending ? "Sharing…" : "Share"}
        </button>
      ) : (
        <>
          <button className="btn" disabled={working} onClick={copy}>
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button className="btn btn-ghost" disabled={working} onClick={() => disable.mutate(playlistId)}>
            {disable.isPending ? "Turning off…" : "Disable"}
          </button>
        </>
      )}

      {shareUrl && (
        <span style={{ fontSize: 12, opacity: 0.8, maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis" }}>
          {shareUrl}
        </span>
      )}

      {info.error && <span style={{ color: "crimson", fontSize: 12 }}>{String(info.error)}</span>}
    </div>
  );
}
