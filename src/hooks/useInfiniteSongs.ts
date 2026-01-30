import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchSongs } from "../api/songs";
import type { SongsQuery, SongsResult } from "../api/songs";

type InfiniteSongsParams = Omit<SongsQuery, "offset">;

export function useInfiniteSongs(params: InfiniteSongsParams) {
  const limit = params.limit ?? 50;

  return useInfiniteQuery<SongsResult>({
    queryKey: ["songs_infinite", params],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const page = Number(pageParam) || 0;
      return fetchSongs({
        ...params,
        limit,
        offset: page * limit,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      const total = lastPage.count ?? 0;
      const nextOffset = allPages.length * limit;
      if (nextOffset >= total) return undefined;
      return allPages.length;
    },
    staleTime: 30_000,
  });
}
