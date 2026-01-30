import { supabase } from "../lib/supabaseClient";

export async function enablePlaylistShare(playlistId: string) {
  const token = crypto.randomUUID();

  const { data, error } = await supabase
    .from("playlists")
    .update({ is_public: true, share_token: token })
    .eq("id", playlistId)
    .select("id, is_public, share_token")
    .single();

  if (error) throw error;
  return data as { id: string; is_public: boolean; share_token: string | null };
}

export async function disablePlaylistShare(playlistId: string) {
  const { data, error } = await supabase
    .from("playlists")
    .update({ is_public: false, share_token: null })
    .eq("id", playlistId)
    .select("id, is_public, share_token")
    .single();

  if (error) throw error;
  return data as { id: string; is_public: boolean; share_token: string | null };
}

export async function getPlaylistShareInfo(playlistId: string) {
  const { data, error } = await supabase
    .from("playlists")
    .select("id, name, is_public, share_token")
    .eq("id", playlistId)
    .single();

  if (error) throw error;
  return data as { id: string; name: string; is_public: boolean; share_token: string | null };
}
