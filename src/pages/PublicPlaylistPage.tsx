import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { usePublicPlaylist } from "../hooks/usePublicPlaylist";

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

function formatDurationMs(ms: number | null | undefined) {
  if (typeof ms !== "number" || !isFinite(ms) || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatTotalDurationMs(ms: number) {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export default function PublicPlaylistPage() {
  const { token } = useParams();
  const q = usePublicPlaylist(token);

  const totalMs = useMemo(() => {
    const songs = q.data?.songs ?? [];
    let sum = 0;
    for (const s of songs as any[]) {
      const ms = s?.duration_ms;
      if (typeof ms === "number" && isFinite(ms) && ms > 0) sum += ms;
    }
    return sum;
  }, [q.data?.songs]);

  if (q.isLoading) return <div style={{ padding: 18 }}>Loading playlist…</div>;
  if (q.error || !q.data) return <div style={{ padding: 18, color: "crimson" }}>This link is invalid or disabled.</div>;

  const { playlist, songs } = q.data;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{playlist.name}</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>Read-only shared playlist</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ opacity: 0.75, fontSize: 13 }}>{songs.length} songs</span>
          <span className="badge" style={{ borderColor: "rgba(53,215,255,0.35)" }}>
            Total: {songs.length ? formatTotalDurationMs(totalMs) : "—"}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 14 }} className="table-wrap">
        <table className="table">
          <thead className="thead">
            <tr>
              <th className="th" style={{ width: 72 }}>
                Art
              </th>
              <th className="th">Song</th>
              <th className="th">Artist</th>
              <th className="th">Tuning</th>
              <th className="th" style={{ width: 90 }}>
                Length
              </th>
            </tr>
          </thead>

          <tbody className="tbody">
            {songs.length ? (
              songs.map((s) => (
                <tr key={s.id} className="tr">
                  <td className="td">
                    <div style={{ width: 56, height: 56 }}>
                      <img
                        src={s.image_url || FALLBACK_COVER}
                        width={56}
                        height={56}
                        className="cover"
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </td>
                  <td className="td">{s.name}</td>
                  <td className="td">{s.artist}</td>
                  <td className="td">{s.tuning ?? ""}</td>
                  <td className="td" style={{ opacity: 0.75, fontSize: 13, whiteSpace: "nowrap" }}>
                    {formatDurationMs((s as any).duration_ms)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="td" colSpan={5} style={{ padding: 16, opacity: 0.75 }}>
                  This playlist is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
