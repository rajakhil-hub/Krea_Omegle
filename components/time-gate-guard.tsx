"use client";

import { useTimeGate } from "@/hooks/use-time-gate";
import { CountdownTimer } from "./countdown-timer";

export function TimeGateGuard({ children }: { children: React.ReactNode }) {
  const { isOpen, appKilled, formattedCountdown, waitingCount, openTime, closeTime } = useTimeGate();

  if (!isOpen) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-semibold">
            {appKilled ? "App is currently offline" : "Chat is currently closed"}
          </h2>

          {!appKilled && formattedCountdown && (
            <CountdownTimer formattedCountdown={formattedCountdown} openTime={openTime} />
          )}

          {appKilled ? (
            <p className="text-sm text-[var(--muted)]">
              Please check back later
            </p>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Available daily from {openTime} to {closeTime}
            </p>
          )}

          <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-6 py-4 inline-block">
            <div className="text-3xl font-bold text-purple-400">{waitingCount}</div>
            <div className="text-sm text-[var(--muted)] mt-1">people waiting</div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
