const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string | undefined;

if (!functionsUrl) {
  throw new Error("Missing VITE_SUPABASE_FUNCTIONS_URL in .env.local");
}

/**
 * Calls a Supabase Edge Function WITHOUT triggering CORS preflight.
 * We send JSON as text/plain so the browser won't do OPTIONS.
 */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${functionsUrl}/${name}`, {
    method: "POST",
    // IMPORTANT: text/plain avoids preflight (OPTIONS)
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Function ${name} failed: ${res.status} ${res.statusText} - ${text}`);
  }

  // function returns JSON
  return (text ? JSON.parse(text) : null) as T;
}
