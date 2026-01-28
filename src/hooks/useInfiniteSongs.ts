import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchSongs } from "../api/songs";

type SongsResultLike<TSong> = {
  rows: TSong[];
  count: number;
};

type InfiniteSongsParams = {
  q?: string;
  sortBy?: "name" | "artist" | "tuning" | "created_at";
  sortDir?: "asc" | "desc";
  limit?: number;
  playlistId?: string | null;
};

// minimal song shape needed for the list
type SongLike = {
  id: string;
};

export function useInfiniteSongs(params: InfiniteSongsParams) {
  const limit = params.limit ?? 50;

  return useInfiniteQuery<SongsResultLike<SongLike>>({
    queryKey: ["songs_infinite", params],
    initialPageParam: 0, // page index
    queryFn: async ({ pageParam }) => {
      const page = Number(pageParam) || 0;
      // fetchSongs returns { rows, count } already
      return (await fetchSongs({
        ...params,
        limit,
        offset: page * limit,
      })) as SongsResultLike<SongLike>;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + (p.rows?.length ?? 0), 0);
      const total = lastPage.count ?? 0;
      if (loaded >= total) return undefined;
      return allPages.length; // next page index
    },
    staleTime: 30_000,
  });
}
