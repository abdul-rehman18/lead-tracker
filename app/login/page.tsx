import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
      <form action={login} className="space-y-4">
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Password</span>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">Invalid email or password.</p>}
        <button
          type="submit"
          className="w-full rounded bg-gray-900 px-3 py-2 text-white hover:bg-gray-700"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
