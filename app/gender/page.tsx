"use client";

import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/use-socket";
import { useEffect } from "react";
import { Navbar } from "@/components/navbar";

const GENDERS = [
  { value: "male" as const, label: "Male" },
  { value: "female" as const, label: "Female" },
  { value: "other" as const, label: "Other" },
];

export default function GenderPage() {
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  // If gender already selected this session, skip to lobby
  useEffect(() => {
    if (sessionStorage.getItem("gender")) {
      router.replace("/lobby");
    }
  }, [router]);

  const selectGender = (gender: "male" | "female" | "other") => {
    sessionStorage.setItem("gender", gender);
    if (socket && isConnected) {
      socket.emit("set_gender", gender);
    }
    router.push("/lobby");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">Select your gender</h2>
          </div>

          <div className="flex gap-4 justify-center">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                onClick={() => selectGender(g.value)}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-8 py-4 text-lg font-medium transition hover:border-purple-500 hover:bg-purple-600/10"
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
