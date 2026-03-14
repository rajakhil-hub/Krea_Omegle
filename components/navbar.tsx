"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

const ADMIN_EMAIL = "akhil_raj.sias24@krea.ac.in";

export function Navbar() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-[var(--card-border)] bg-[var(--card)]">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-bold">
          Krea <span className="text-purple-500">Omegle</span>
        </h1>
      </div>

      {session?.user && (
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded px-3 py-1 text-sm text-purple-400 transition hover:bg-purple-600/20"
            >
              Admin
            </Link>
          )}
          <div className="flex items-center gap-2">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt=""
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <span className="text-sm text-[var(--muted)]">
              {session.user.name}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded px-3 py-1 text-sm text-[var(--muted)] transition hover:bg-[var(--card-border)] hover:text-white"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
