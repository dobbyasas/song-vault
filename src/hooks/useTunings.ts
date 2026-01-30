import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function fetchTunings() {
  const { data, error } = await supabase
    .from("songs")
    .select("tuning")
    .not("tuning", "is", null);

  if (error) throw error;

  const set = new Set<string>();
  for (const row of data ?? []) {
    const t = String((row as any).tuning ?? "").trim();
    if (t) set.add(t);
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function useTunings() {
  return useQuery({
    queryKey: ["tunings"],
    queryFn: fetchTunings,
    staleTime: 60_000,
  });
}
