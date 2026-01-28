// src/hooks/usePlaylists.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addSongToPlaylist,
  createPlaylist,
  deletePlaylist,
  fetchPlaylists,
  removeSongFromPlaylist,
} from "../api/playlists";

export function usePlaylists() {
  return useQuery({
    queryKey: ["playlists"],
    queryFn: fetchPlaylists,
    staleTime: 30_000,
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      user_id,
      name,
      description,
    }: {
      user_id: string;
      name: string;
      description?: string | null;
    }) => createPlaylist(user_id, name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePlaylist(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["playlists"] }),
  });
}

export function useAddSongToPlaylist() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ playlist_id, song_id }: { playlist_id: string; song_id: string }) =>
      addSongToPlaylist(playlist_id, song_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}

export function useRemoveSongFromPlaylist() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ playlist_id, song_id }: { playlist_id: string; song_id: string }) =>
      removeSongFromPlaylist(playlist_id, song_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}
