import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginButton } from "@/components/login-button";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session) {
    redirect("/gender");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">
            Krea <span className="text-purple-500">Omegle</span>
          </h1>
          <p className="text-[var(--muted)] text-lg">
            Connect with fellow Krea students anonymously
          </p>
          <p className="text-sm text-[var(--muted)]">
            Available 11 PM – 2 AM · @krea.ac.in only
          </p>
        </div>

        {params.reason === "outside-hours" && (
          <div className="rounded-lg bg-yellow-900/30 border border-yellow-700/50 px-4 py-3 text-sm text-yellow-200">
            Chat is currently closed. Come back at 11 PM!
          </div>
        )}

        {params.reason === "unauthorized" && (
          <div className="rounded-lg bg-red-900/30 border border-red-700/50 px-4 py-3 text-sm text-red-200">
            Only @krea.ac.in email addresses are allowed.
          </div>
        )}

        <LoginButton />
      </div>
    </main>
  );
}
