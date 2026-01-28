import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { callFunction } from "../lib/functionsClient";

export function TestSpotifyButton() {
  const [out, setOut] = useState<string>("");

  async function run() {
    setOut("Running…");

    // pick 1 song missing an image
    const { data: song, error: selErr } = await supabase
      .from("songs")
      .select("id,name,artist,image_url,spotify_id")
      .is("image_url", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selErr) {
      setOut(`Select error: ${selErr.message}`);
      return;
    }
    if (!song) {
      setOut("No songs missing images.");
      return;
    }

    try {
      const payload = { song_id: song.id, name: song.name, artist: song.artist };
      const data = await callFunction<any>("resolve_spotify", payload);

      setOut(`OK: ${JSON.stringify(data)}\n`);

      // read back the row
      const { data: updated, error: readErr } = await supabase
        .from("songs")
        .select("id,name,artist,image_url,spotify_id")
        .eq("id", song.id)
        .single();

      if (readErr) {
        setOut((prev) => prev + `Readback error: ${readErr.message}`);
        return;
      }

      setOut((prev) => prev + `Updated row: ${JSON.stringify(updated)}`);
    } catch (e: any) {
      console.error(e);
      setOut(`Function call failed: ${e?.message ?? String(e)}`);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button className="btn" onClick={run}>
        Test Spotify Resolve (1 song)
      </button>

      {out && (
        <pre style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.9 }}>
          {out}
        </pre>
      )}
    </div>
  );
}
