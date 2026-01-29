import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createSong } from "../api/songs";
import { callFunction } from "../lib/functionsClient";

type NewSong = {
  user_id: string;
  name: string;
  artist: string;
  tuning?: string | null;
};

export function useCreateSong() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: NewSong) => {
      const song = await createSong(payload);

      callFunction("resolve_spotify", {
        song_id: song.id,
        name: song.name,
        artist: song.artist,
      })
        .then(() => qc.invalidateQueries({ queryKey: ["songs"] }))
        .catch((e) => {
          console.warn("resolve_spotify failed:", e);
        });

      return song;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}
