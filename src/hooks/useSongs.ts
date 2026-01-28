import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSongs, updateSong } from "../api/songs";

type SongsQuery = {
  q?: string;
  sortBy?: "name" | "artist" | "tuning" | "created_at";
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

type Song = {
  id: string;
  user_id: string;
  name: string;
  artist: string;
  tuning: string | null;
  spotify_id: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export function useSongs(params: SongsQuery) {
  return useQuery({
    queryKey: ["songs", params],
    queryFn: () => fetchSongs(params),
    staleTime: 30_000,
    keepPreviousData: true,
  });
}

export function useUpdateSong() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<Song, "name" | "artist" | "tuning" | "spotify_id">>;
    }) => updateSong(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}
