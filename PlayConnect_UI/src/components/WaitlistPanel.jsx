// src/components/WaitlistPanel.jsx
import { useEffect, useState } from "react";
import { getWaitlist, joinWaitlist, leaveWaitlist } from "../Api/waitlist";

export default function WaitlistPanel({ gameId, currentUserId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function refresh() {
    try {
      setErr("");
      setLoading(true);
      const data = await getWaitlist(gameId);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message || "Failed to load waitlist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // simple polling every 5s; swap with websockets later if you like
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [gameId]);

  const meInQueue = items.findIndex(i => String(i.user_id ?? i.id) === String(currentUserId));
  const myPosition = meInQueue >= 0 ? meInQueue + 1 : null;

  async function handleJoin() {
    try {
      await joinWaitlist(gameId, currentUserId);
      refresh();
    } catch (e) {
      setErr(e.message || "Failed to join waitlist");
    }
  }

  async function handleLeave() {
    try {
      await leaveWaitlist(gameId, currentUserId);
      refresh();
    } catch (e) {
      setErr(e.message || "Failed to leave waitlist");
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Waitlist</h3>
        {myPosition ? (
          <span className="text-sm">Your position: <b>{myPosition}</b></span>
        ) : (
          <span className="text-sm text-gray-500">You are not in the queue</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : err ? (
        <p className="text-sm text-red-600">{err}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No one is waiting.</p>
      ) : (
        <ol className="list-decimal pl-6 space-y-1">
          {items.map((u, idx) => (
            <li key={u.user_id ?? u.id}>
              {u.name ?? u.full_name ?? `User ${u.user_id ?? u.id}`} — position {idx + 1}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex gap-2">
        {myPosition ? (
          <button onClick={handleLeave} className="px-3 py-1 rounded border">
            Leave queue
          </button>
        ) : (
          <button onClick={handleJoin} className="px-3 py-1 rounded border">
            Join queue
          </button>
        )}
        <button onClick={refresh} className="px-3 py-1 rounded border">Refresh</button>
      </div>
    </div>
  );
}