import { useState } from "react";
import { useSession } from "./hooks/useSession";
import { AuthCard } from "./components/AuthCard";
import { supabase } from "./lib/supabaseClient";
import { AddSongForm } from "./components/AddSongForm";
import { SongsTable } from "./components/SongsTable";
import { TestSpotifyButton } from "./components/TestSpotifyButton";
import { PlaylistsSidebar } from "./components/PlaylistsSidebar";

export default function App() {
  const { session, loading } = useSession();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  if (loading) return <div className="cyber-shell"><div className="container">Loading…</div></div>;
  if (!session) return <AuthCard />;

  return (
    <div className="cyber-shell">
      <div className="container fade-in">
        <div className="cyber-topbar">
          <div className="cyber-title">
            <h1 className="pulse">SONG VAULT</h1>
            <div className="sub">CYBERPUNK • SUPABASE • REACT</div>
          </div>

          <div className="row">
            <span className="badge">{session.user.email}</span>
            <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </div>

        <div className="card fade-in">
          <div className="card-inner">
            <AddSongForm userId={session.user.id} />
            <hr className="hr" />

            {/* Layout: sidebar left, songs right */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <PlaylistsSidebar
                userId={session.user.id}
                selectedPlaylistId={selectedPlaylistId}
                onSelect={setSelectedPlaylistId}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <SongsTable playlistId={selectedPlaylistId} userId={session.user.id} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
