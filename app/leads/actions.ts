"use server";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isStatus } from "@/lib/statuses";

export async function addLead(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();

  if (!name) {
    throw new Error("Name is required.");
  }

  const supabase = await createClient();

  // user_id is deliberately NOT sent. The column defaults to auth.uid() in
  // Postgres, and the insert policy rejects any row whose user_id differs from
  // the session user, so a lead can only ever be created for the caller.
  const { error } = await supabase.from("leads").insert({
    name,
    email: email || null,
    source: source || null,
  });

  if (error) {
    throw new Error("Could not add lead.");
  }

  revalidatePath("/leads");
}

export async function updateStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status");

  // Validate against the allowlist before the database is touched.
  if (!isStatus(status)) {
    throw new Error("Invalid status.");
  }

  const supabase = await createClient();

  // RLS filters this UPDATE by user_id = auth.uid(). For a lead the caller
  // does not own, zero rows match, `data` is null, and we answer with the same
  // 404 the detail page gives, so the caller learns nothing about the row.
  const { data, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error("Could not update status.");
  }
  if (!data) {
    notFound();
  }

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}
