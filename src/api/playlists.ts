import { supabase } from "../lib/supabaseClient";

export type Playlist = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export async function fetchPlaylists() {
  const { data, error } = await supabase
    .from("playlists")
    .select("id,user_id,name,description,created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Playlist[];
}

export async function createPlaylist(user_id: string, name: string, description?: string | null) {
  const { data, error } = await supabase
    .from("playlists")
    .insert({ user_id, name, description: description ?? null })
    .select("id,user_id,name,description,created_at")
    .single();

  if (error) throw error;
  return data as Playlist;
}

export async function deletePlaylist(id: string) {
  const { error } = await supabase.from("playlists").delete().eq("id", id);
  if (error) throw error;
}

export async function addSongToPlaylist(playlist_id: string, song_id: string) {
  const { error } = await supabase.from("playlist_songs").insert({ playlist_id, song_id });
  if (error) throw error;
}

export async function removeSongFromPlaylist(playlist_id: string, song_id: string) {
  const { error } = await supabase
    .from("playlist_songs")
    .delete()
    .eq("playlist_id", playlist_id)
    .eq("song_id", song_id);

  if (error) throw error;
}
