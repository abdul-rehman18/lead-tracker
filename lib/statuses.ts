// The only three statuses a lead can have. The database CHECK constraint
// enforces the same list; the server action validates against this before
// touching the database.
export const STATUSES = ["New", "Contacted", "Signed"] as const;
export type Status = (typeof STATUSES)[number];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}
