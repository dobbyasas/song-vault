import { supabase } from "../lib/supabaseClient";

export type Song = {
  id: string;
  user_id: string;
  name: string;
  artist: string;
  tuning: string | null;
  spotify_id: string | null;
  image_url: string | null;
  created_at: string;
};

export type SongsQuery = {
  q?: string;
  sortBy?: "name" | "artist" | "tuning" | "created_at";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
  playlistId?: string | null;
};

export type SongsResult = {
  rows: Song[];
  count: number;
};

export async function fetchSongs(params: SongsQuery): Promise<SongsResult> {
  const {
    q = "",
    sortBy = "created_at",
    sortDir = "desc",
    limit = 50,
    offset = 0,
    playlistId = null,
  } = params;

  let playlistSongIds: string[] | null = null;

  if (playlistId) {
    const { data: ids, error: idsErr } = await supabase
      .from("playlist_songs")
      .select("song_id")
      .eq("playlist_id", playlistId);

    if (idsErr) throw idsErr;

    playlistSongIds = (ids ?? []).map((x: any) => x.song_id).filter(Boolean);
    if (playlistSongIds.length === 0) return { rows: [], count: 0 };
  }

  let query = supabase
    .from("songs")
    .select("id,user_id,name,artist,tuning,spotify_id,image_url,created_at", { count: "exact" });

  if (q.trim()) {
    const like = `%${q.trim()}%`;
    query = query.or(`name.ilike.${like},artist.ilike.${like},tuning.ilike.${like}`);
  }

  if (playlistSongIds) query = query.in("id", playlistSongIds);

  query = query.order(sortBy, { ascending: sortDir === "asc", nullsFirst: false });

  const from = offset;
  const to = offset + limit - 1;

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  return { rows: (data ?? []) as Song[], count: count ?? 0 };
}

export async function createSong(input: {
  user_id: string;
  name: string;
  artist: string;
  tuning?: string | null;
}): Promise<Song> {
  const { data, error } = await supabase
    .from("songs")
    .insert({
      user_id: input.user_id,
      name: input.name,
      artist: input.artist,
      tuning: input.tuning ?? null,
    })
    .select("id,user_id,name,artist,tuning,spotify_id,image_url,created_at")
    .single();

  if (error) throw error;
  return data as Song;
}

export async function updateSong(
  id: string,
  patch: Partial<Pick<Song, "name" | "artist" | "tuning" | "spotify_id" | "image_url">>
): Promise<Song> {
  const { data, error } = await supabase
    .from("songs")
    .update(patch)
    .eq("id", id)
    .select("id,user_id,name,artist,tuning,spotify_id,image_url,created_at")
    .single();

  if (error) throw error;
  return data as Song;
}

export async function deleteSong(id: string): Promise<void> {
  const { error } = await supabase.from("songs").delete().eq("id", id);
  if (error) throw error;
}
