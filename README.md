# Songs App

## Run with Docker

This app is a Vite frontend that talks to Supabase, so the container only needs the frontend code plus your existing local env file.

1. Make sure `.env.local` exists in the project root with:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_FUNCTIONS_URL`
2. Start the app:

```bash
docker compose up --build
```

3. Open [http://localhost:5173](http://localhost:5173)

### Notes

- Source files are bind-mounted into the container, so Vite hot reload keeps working while you edit.
- Dependencies live in a Docker volume, which avoids conflicts with host `node_modules`.
- Stop the app with `Ctrl+C`, then remove containers with `docker compose down`.
