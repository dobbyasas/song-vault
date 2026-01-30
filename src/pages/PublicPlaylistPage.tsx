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

export default function PublicPlaylistPage() {
  const { token } = useParams();
  const q = usePublicPlaylist(token);

  if (q.isLoading) return <div style={{ padding: 18 }}>Loading playlist…</div>;
  if (q.error) return <div style={{ padding: 18, color: "crimson" }}>This link is invalid or disabled.</div>;

  const { playlist, songs } = q.data!;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{playlist.name}</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>Read-only shared playlist</div>
        </div>

        <div style={{ opacity: 0.75, fontSize: 13 }}>{songs.length} songs</div>
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
                </tr>
              ))
            ) : (
              <tr>
                <td className="td" colSpan={4} style={{ padding: 16, opacity: 0.75 }}>
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
