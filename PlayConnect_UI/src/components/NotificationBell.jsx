import { useEffect, useMemo, useRef, useState } from "react";
import { listNotifications, unreadCount, markAllRead } from "../Api/notifications";
import { notifEvents } from "./ToastPortal";

function useOutsideClick(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

export default function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const ref = useOutsideClick(() => setOpen(false));

  async function refreshCount() {
    try { setCount(await unreadCount(userId)); } catch { setCount(0); }
  }
  async function loadList() {
    try { setItems(await listNotifications({ userId, limit: 30 })); } catch { setItems([]); }
  }

  useEffect(() => {
    refreshCount();
    const bump = () => refreshCount();
    window.addEventListener("notif:bump", bump);
    return () => window.removeEventListener("notif:bump", bump);
  }, [userId]);

  useEffect(() => { if (open) loadList(); }, [open]);

  const unreadIds = useMemo(() => items.filter(i => !i.is_read).map(i => i.notification_id), [items]);

  async function handleMarkAll() {
    await markAllRead(unreadIds);
    setItems(prev => prev.map(i => ({ ...i, is_read: true })));
    setCount(0);
  }

  return (
    <div className="relative" ref={ref}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(v => !v)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-white transition hover:bg-neutral-700 cursor-pointer"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white shadow">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </div>

      {open && (
        <div className="absolute right-0 mt-3 w-96 max-w-[22rem] rounded-2xl border border-neutral-800 bg-neutral-900/95 p-3 shadow-2xl ring-1 ring-black/40 backdrop-blur">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <p className="text-sm font-semibold text-white">Notifications</p>
            {unreadIds.length > 0 && (
              <button
                onClick={handleMarkAll}
                className="text-xs font-semibold text-violet-300 hover:text-violet-200"
              >
                Mark all as read
              </button>
            )}
          </div>
          <ul className="mt-2 max-h-[60vh] space-y-2 overflow-auto text-sm">
            {items.length === 0 && (
              <li className="rounded-xl border border-neutral-800/70 bg-neutral-900/70 px-3 py-4 text-center text-neutral-400">
                No notifications yet
              </li>
            )}
            {items.map(n => (
              <li
                key={n.notification_id}
                className={`rounded-xl border px-3 py-3 ${
                  n.is_read
                    ? "border-neutral-800/60 bg-neutral-900/60"
                    : "border-violet-500/40 bg-violet-500/10"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
                  {titleFromType(n.type)}
                </div>
                <div className="text-sm text-white">{n.message}</div>
                <div className="text-xs text-neutral-500">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function titleFromType(t) {
  switch (t) {
    case "waitlist": return "Waitlist update";
    case "game_update": return "Game update";
    case "game_full": return "Game full";
    case "game_cancelled": return "Game cancelled";
    case "reminder": return "Reminder";
    default: return "Notification";
  }
}
