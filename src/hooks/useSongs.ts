// src/hooks/useSongs.ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSongs, updateSong, SongsQuery, Song } from "../api/songs";

export function useSongs(params: SongsQuery) {
  return useQuery({
    queryKey: ["songs", params],
    queryFn: () => fetchSongs(params),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useUpdateSong() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Song, "name" | "artist" | "tuning" | "spotify_id">> }) =>
      updateSong(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
      qc.invalidateQueries({ queryKey: ["songs_infinite"] });
    },
  });
}
