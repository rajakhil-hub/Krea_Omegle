"use client";

interface CountdownTimerProps {
  formattedCountdown: string;
  openTime?: string;
}

export function CountdownTimer({ formattedCountdown, openTime }: CountdownTimerProps) {
  return (
    <div className="text-center space-y-4">
      <div className="text-6xl font-mono font-bold text-purple-400 tracking-wider">
        {formattedCountdown}
      </div>
      {openTime && (
        <p className="text-[var(--muted)] text-lg">
          Chat opens at {openTime}
        </p>
      )}
    </div>
  );
}
