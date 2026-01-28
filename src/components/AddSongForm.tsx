import { useState } from "react";
import { useCreateSong } from "../hooks/useCreateSong";

export function AddSongForm({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [artist, setArtist] = useState("");
  const [tuning, setTuning] = useState("");

  const create = useCreateSong();

  const disabled = create.isPending || !name.trim() || !artist.trim();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    create.mutate(
      {
        user_id: userId,
        name: name.trim(),
        artist: artist.trim(),
        tuning: tuning.trim() || null,
      },
      {
        onSuccess: () => {
          setName("");
          setArtist("");
          setTuning("");
        },
      }
    );
  }

  return (
    <div className="fade-in">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", letterSpacing: "0.12em", fontSize: 12, color: "var(--muted)" }}>
            NEW ENTRY
          </div>
          <div style={{ fontSize: 18, marginTop: 4, textShadow: "var(--glow)" }}>Add song</div>
        </div>

        <span className="badge">Required: name + artist</span>
      </div>

      <form onSubmit={onSubmit} className="stack">
        <div className="row" style={{ alignItems: "stretch" }}>
          <div style={{ flex: 1 }}>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Song name *"
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              className="input"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Artist name *"
            />
          </div>
        </div>

        <div className="row" style={{ alignItems: "stretch" }}>
          <div style={{ flex: 1 }}>
            <input
              className="input"
              value={tuning}
              onChange={(e) => setTuning(e.target.value)}
              placeholder="Tuning (e.g. Drop C#, Standard, etc.)"
            />
          </div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
            <span className="badge" style={{ borderColor: "rgba(255,43,214,0.25)" }}>
              Spotify ID + cover fetched automatically
            </span>
          </div>
        </div>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {create.isPending ? "Uploading to vault…" : "After adding, we’ll auto-match Spotify + cover art."}
          </div>

          <button className="btn" disabled={disabled} type="submit">
            {create.isPending ? "Adding…" : "Add"}
          </button>
        </div>

        {create.error && (
          <div style={{ color: "crimson", fontSize: 13 }}>
            {(create.error as any)?.message ?? "Failed to add song"}
          </div>
        )}

        {create.isSuccess && !create.isPending && (
          <div style={{ color: "rgba(53,215,255,0.9)", fontSize: 13 }}>
            Added ✅ (Spotify matching running…)
          </div>
        )}
      </form>
    </div>
  );
}
