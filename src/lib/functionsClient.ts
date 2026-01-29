const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;

if (!functionsUrl) {
  throw new Error("Missing VITE_SUPABASE_FUNCTIONS_URL in .env.local");
}

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${functionsUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Function ${name} failed: ${res.status} ${res.statusText} - ${text}`);
  }

  return (text ? JSON.parse(text) : null) as T;
}
