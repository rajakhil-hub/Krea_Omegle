"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar";

interface Stats {
  online: number;
  inQueue: number;
  inRooms: number;
  rooms: number;
  gender: { male: number; female: number; other: number; unset: number };
  schools: Record<string, number>;
  timeGate: { startHour: number; endHour: number; timezone: string };
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [startHour, setStartHour] = useState(0);
  const [endHour, setEndHour] = useState(24);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStats(data);
      setStartHour(data.timeGate.startHour);
      setEndHour(data.timeGate.endHour);
    } catch {
      console.error("Failed to fetch stats");
    }
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const updateTimeGate = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/time-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startHour, endHour }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage("Time gate updated!");
        fetchStats();
      } else {
        setMessage(data.error || "Failed to update");
      }
    } catch {
      setMessage("Network error");
    }
    setSaving(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto w-full max-w-4xl p-6 space-y-6">
        <h2 className="text-2xl font-bold">Admin Dashboard</h2>

        {!stats ? (
          <p className="text-[var(--muted)]">Loading stats...</p>
        ) : (
          <>
            {/* Online Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Online" value={stats.online} color="purple" />
              <StatCard label="In Queue" value={stats.inQueue} color="yellow" />
              <StatCard label="In Chats" value={stats.inRooms} color="green" />
              <StatCard label="Active Rooms" value={stats.rooms} color="blue" />
            </div>

            {/* Gender Breakdown */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <h3 className="text-lg font-semibold mb-4">Gender Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <GenderCard label="Male" count={stats.gender.male} total={stats.online} color="#6366f1" />
                <GenderCard label="Female" count={stats.gender.female} total={stats.online} color="#ec4899" />
                <GenderCard label="Other" count={stats.gender.other} total={stats.online} color="#8b5cf6" />
                <GenderCard label="Not Set" count={stats.gender.unset} total={stats.online} color="#6b7280" />
              </div>
            </div>

            {/* School Breakdown */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <h3 className="text-lg font-semibold mb-4">School Breakdown</h3>
              {Object.keys(stats.schools).length === 0 ? (
                <p className="text-[var(--muted)] text-sm">No users online</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(stats.schools).map(([school, count]) => (
                    <div key={school} className="rounded-lg bg-[var(--background)] px-4 py-3 text-center">
                      <div className="text-xl font-bold text-purple-400">{count}</div>
                      <div className="text-sm text-[var(--muted)]">{school}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Time Gate Controls */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
              <h3 className="text-lg font-semibold mb-4">App Timing</h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Set when the app is available. Use 0–24 to keep it always open.
                Timezone: {stats.timeGate.timezone}
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">Start Hour</label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={startHour}
                    onChange={(e) => setStartHour(Number(e.target.value))}
                    className="w-24 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--muted)] mb-1">End Hour</label>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={endHour}
                    onChange={(e) => setEndHour(Number(e.target.value))}
                    className="w-24 rounded-lg border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-center"
                  />
                </div>
                <button
                  onClick={updateTimeGate}
                  disabled={saving}
                  className="rounded-lg bg-purple-600 px-6 py-2 font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Update"}
                </button>
              </div>
              {message && (
                <p className="mt-3 text-sm text-green-400">{message}</p>
              )}
              <p className="mt-3 text-xs text-[var(--muted)]">
                Current setting: {stats.timeGate.startHour}:00 – {stats.timeGate.endHour}:00
                {stats.timeGate.startHour === 0 && stats.timeGate.endHour === 24
                  ? " (always open)"
                  : ""}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClass = {
    purple: "text-purple-400",
    yellow: "text-yellow-400",
    green: "text-green-400",
    blue: "text-blue-400",
  }[color] || "text-white";

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4 text-center">
      <div className={`text-3xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-sm text-[var(--muted)] mt-1">{label}</div>
    </div>
  );
}

function GenderCard({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-lg bg-[var(--background)] p-4 text-center">
      <div className="text-2xl font-bold" style={{ color }}>{count}</div>
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-2 h-1.5 rounded-full bg-gray-700 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-xs text-[var(--muted)] mt-1">{pct}%</div>
    </div>
  );
}
