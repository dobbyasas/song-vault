import { useQuery } from "@tanstack/react-query";
import { fetchPublicPlaylistByToken } from "../api/publicPlaylist";

export function usePublicPlaylist(token: string | undefined) {
  return useQuery({
    queryKey: ["public-playlist", token],
    queryFn: () => fetchPublicPlaylistByToken(token as string),
    enabled: !!token,
  });
}
