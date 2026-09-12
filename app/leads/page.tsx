import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUSES } from "@/lib/statuses";
import { logout } from "@/app/login/actions";
import { addLead } from "./actions";

export default async function LeadsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // No user_id filter is written here on purpose. RLS applies
  // `user_id = auth.uid()` to every SELECT, so this query can only ever
  // return the caller's own leads.
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, email, source, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <form action={logout}>
          <span className="mr-3 text-sm text-gray-500">{user.email}</span>
          <button type="submit" className="text-sm text-gray-700 underline">
            Sign out
          </button>
        </form>
      </div>

      <form action={addLead} className="grid gap-3 rounded border border-gray-200 p-4 sm:grid-cols-4">
        <input
          name="name"
          placeholder="Name"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded border border-gray-300 px-3 py-2"
        />
        <input
          name="source"
          placeholder="Source"
          className="rounded border border-gray-300 px-3 py-2"
        />
        <button type="submit" className="rounded bg-gray-900 px-3 py-2 text-white hover:bg-gray-700">
          Add lead
        </button>
      </form>

      {STATUSES.map((status) => {
        const group = (leads ?? []).filter((lead) => lead.status === status);
        return (
          <section key={status}>
            <h2 className="mb-2 text-lg font-medium">
              {status} <span className="text-sm text-gray-500">({group.length})</span>
            </h2>
            {group.length === 0 ? (
              <p className="text-sm text-gray-500">No leads.</p>
            ) : (
              <ul className="divide-y divide-gray-200 rounded border border-gray-200">
                {group.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between px-4 py-2">
                    <Link href={`/leads/${lead.id}`} className="font-medium underline">
                      {lead.name}
                    </Link>
                    <span className="text-sm text-gray-500">
                      {lead.email ?? "no email"} · {lead.source ?? "no source"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
