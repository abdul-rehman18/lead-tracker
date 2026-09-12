// Prints the Cookie header for a signed-in user, in exactly the format
// @supabase/ssr writes to the browser. Used by verify-isolation.md so curl can
// hit the app as user B. Reads NEXT_PUBLIC_* from .env.local; only the public
// key is used.
//
//   node scripts/session-cookie.mjs b@example.com password123
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => l.split("=").map((s) => s.trim())),
);

const [email, password] = process.argv.slice(2);
const jar = new Map();

const supabase = createServerClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  },
);

const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log([...jar].map(([n, v]) => `${n}=${v}`).join("; "));
