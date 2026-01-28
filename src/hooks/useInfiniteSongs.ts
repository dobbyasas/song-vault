// src/hooks/useInfiniteSongs.ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchSongs, SongsQuery, SongsResult } from "../api/songs";

type InfiniteSongsParams = Omit<SongsQuery, "offset">;

export function useInfiniteSongs(params: InfiniteSongsParams) {
  const limit = params.limit ?? 50;

  return useInfiniteQuery<SongsResult>({
    queryKey: ["songs_infinite", params],
    initialPageParam: 0, // page index
    queryFn: ({ pageParam }) => {
      const page = Number(pageParam) || 0;
      return fetchSongs({
        ...params,
        limit,
        offset: page * limit,
      });
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
