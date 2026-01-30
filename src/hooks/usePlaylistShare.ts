import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { disablePlaylistShare, enablePlaylistShare, getPlaylistShareInfo } from "../api/playlistShare";

export function usePlaylistShareInfo(playlistId: string | null) {
  return useQuery({
    queryKey: ["playlist-share", playlistId],
    queryFn: () => getPlaylistShareInfo(playlistId as string),
    enabled: !!playlistId,
  });
}

export function useEnablePlaylistShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: string) => enablePlaylistShare(playlistId),
    onSuccess: (_data, playlistId) => {
      qc.invalidateQueries({ queryKey: ["playlist-share", playlistId] });
      qc.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}

export function useDisablePlaylistShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlistId: string) => disablePlaylistShare(playlistId),
    onSuccess: (_data, playlistId) => {
      qc.invalidateQueries({ queryKey: ["playlist-share", playlistId] });
      qc.invalidateQueries({ queryKey: ["playlists"] });
    },
  });
}
