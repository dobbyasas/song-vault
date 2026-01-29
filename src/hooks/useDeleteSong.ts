import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteSong } from "../api/songs";

export function useDeleteSong() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSong(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["songs"] });
    },
  });
}
