"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCountdown } from "@/lib/time-utils";

interface TimeGateData {
  startHour: number;
  endHour: number;
  timezone: string;
  appKilled: boolean;
  waitingCount: number;
}

function isOpenNow(startHour: number, endHour: number, timezone: string): boolean {
  const now = new Date();
  const timeStr = now.toLocaleString("en-US", { timeZone: timezone, hour: "numeric", hour12: false });
  const currentHour = parseInt(timeStr);

  if (startHour > endHour) {
    return currentHour >= startHour || currentHour < endHour;
  }
  return currentHour >= startHour && currentHour < endHour;
}

function getSecondsUntil(startHour: number, timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value);

  const currentSeconds = get("hour") * 3600 + get("minute") * 60 + get("second");
  const targetSeconds = startHour * 3600;

  if (currentSeconds < targetSeconds) return targetSeconds - currentSeconds;
  return 24 * 3600 - currentSeconds + targetSeconds;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

export function useTimeGate() {
  const [isOpen, setIsOpen] = useState(true); // assume open until fetched
  const [appKilled, setAppKilled] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [gate, setGate] = useState<TimeGateData | null>(null);

  const fetchGate = useCallback(async () => {
    try {
      const res = await fetch("/api/time-gate");
      const data: TimeGateData = await res.json();
      setGate(data);
      setAppKilled(data.appKilled);
      setWaitingCount(data.waitingCount);
    } catch { /* ignore */ }
  }, []);

  // Fetch server time gate settings every 5 seconds
  useEffect(() => {
    fetchGate();
    const interval = setInterval(fetchGate, 5000);
    return () => clearInterval(interval);
  }, [fetchGate]);

  // Update countdown every second using fetched settings
  useEffect(() => {
    if (!gate) return;

    function update() {
      if (!gate) return;
      const open = isOpenNow(gate.startHour, gate.endHour, gate.timezone);
      setIsOpen(open && !gate.appKilled);
      if (!open) {
        setRemainingSeconds(getSecondsUntil(gate.startHour, gate.timezone));
      } else {
        setRemainingSeconds(0);
      }
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [gate]);

  return {
    isOpen: isOpen && !appKilled,
    appKilled,
    remainingSeconds,
    waitingCount,
    formattedCountdown: formatCountdown(remainingSeconds),
    openTime: gate ? formatHour(gate.startHour) : "",
    closeTime: gate ? formatHour(gate.endHour) : "",
  };
}
