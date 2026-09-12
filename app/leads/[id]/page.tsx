import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUSES } from "@/lib/statuses";
import { updateStatus } from "../actions";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id, name, email, source, status, created_at")
    .eq("id", id)
    .maybeSingle();

  // 404, not 403. RLS hides rows the caller does not own, so from this code's
  // point of view "someone else's lead" and "no such lead" are the same thing:
  // the query returns nothing. Answering 403 would confirm that the id exists
  // and belongs to another account, which is itself a data leak (it lets an
  // attacker enumerate valid lead ids). 404 reveals nothing either way.
  if (!lead) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link href="/leads" className="text-sm text-gray-700 underline">
        ← All leads
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{lead.name}</h1>
        <dl className="mt-2 text-sm text-gray-700">
          <div>
            <dt className="inline text-gray-500">Email: </dt>
            <dd className="inline">{lead.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-gray-500">Source: </dt>
            <dd className="inline">{lead.source ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-gray-500">Status: </dt>
            <dd className="inline font-medium">{lead.status}</dd>
          </div>
          <div>
            <dt className="inline text-gray-500">Created: </dt>
            <dd className="inline">{new Date(lead.created_at).toLocaleString("en-GB")}</dd>
          </div>
        </dl>
      </div>

      <form action={updateStatus} className="flex items-center gap-2">
        <input type="hidden" name="id" value={lead.id} />
        <span className="text-sm text-gray-500">Move to:</span>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="submit"
            name="status"
            value={status}
            disabled={status === lead.status}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-40"
          >
            {status}
          </button>
        ))}
      </form>
    </div>
  );
}
