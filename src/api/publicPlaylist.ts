import { supabase } from "../lib/supabaseClient";

export type PublicPlaylist = {
  id: string;
  name: string;
  share_token: string;
  is_public: boolean;
};

export type PublicSong = {
  id: string;
  name: string;
  artist: string;
  tuning: string | null;
  image_url: string | null;
  duration_ms: number | null;
  created_at: string;
};

export async function fetchPublicPlaylistByToken(token: string) {
  const { data: playlist, error: pErr } = await supabase
    .from("playlists")
    .select("id, name, share_token, is_public")
    .eq("share_token", token)
    .eq("is_public", true)
    .single();

  if (pErr) throw pErr;
  if (!playlist) throw new Error("Playlist not found");

  const { data: rows, error: sErr } = await supabase
    .from("playlist_songs")
    .select("song:songs(id,name,artist,tuning,image_url,duration_ms,created_at)")
    .eq("playlist_id", playlist.id);

  if (sErr) throw sErr;

  const songs: PublicSong[] = (rows ?? []).map((r: any) => r.song).filter(Boolean);

  return { playlist: playlist as PublicPlaylist, songs };
}
