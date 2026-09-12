import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Request-scoped Supabase client. It is built from the caller's session cookie
// and the public (anon/publishable) key, so every query it runs is subject to
// Row Level Security in Postgres. There is no other client in this app.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies. proxy.ts refreshes the
            // session cookie on every request, so this is safe to ignore.
          }
        },
      },
    },
  );
}
