import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "./hooks/useSession";
import { AuthCard } from "./components/AuthCard";
import { supabase } from "./lib/supabaseClient";
import { AddSongForm } from "./components/AddSongForm";
import { SongsTable } from "./components/SongsTable";
import { PlaylistsSidebar } from "./components/PlaylistsSidebar";
import { AddSongModal } from "./components/AddSongModal";
import PublicPlaylistPage from "./pages/PublicPlaylistPage";

function AppAuthed() {
  const { session, loading } = useSession();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  if (loading)
    return (
      <div className="cyber-shell">
        <div className="container">Loading…</div>
      </div>
    );

  if (!session) return <AuthCard />;

  return (
    <div className="cyber-shell">
      <div className="container fade-in">
        <div className="cyber-topbar">
          <div className="cyber-title">
            <h1 className="pulse">SONG VAULT</h1>
            <div className="sub">CYBERPUNK • SUPABASE • REACT</div>
          </div>

          <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn add-open-btn" type="button" onClick={() => setAddOpen(true)}>
              Add song
            </button>

            <span className="badge">{session.user.email}</span>

            <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          </div>
        </div>

        <div className="card fade-in">
          <div className="card-inner">
            <div className="add-card-inline">
              <AddSongForm userId={session.user.id} />
              <hr className="hr" />
            </div>

            <div className="vault-layout">
              <PlaylistsSidebar
                userId={session.user.id}
                selectedPlaylistId={selectedPlaylistId}
                onSelect={setSelectedPlaylistId}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <SongsTable playlistId={selectedPlaylistId} />
              </div>
            </div>
          </div>
        </div>

        <AddSongModal open={addOpen} title="Add song" onClose={() => setAddOpen(false)}>
          <AddSongForm userId={session.user.id} />
        </AddSongModal>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/share/playlist/:token" element={<PublicPlaylistPage />} />
      <Route path="/" element={<AppAuthed />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
