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
    <div style={{ position:"relative" }} ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
        style={{ position:"relative", padding:8, borderRadius:9999, border:"none", background:"transparent" }}
      >
        {/* bell icon */}
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M12 2a6 6 0 00-6 6v3.586L4.293 13.293A1 1 0 005 15h14a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
        </svg>
        {count > 0 && (
          <span style={{
            position:"absolute", top:-2, right:-2, minWidth:18, height:18,
            background:"#ef4444", color:"#fff", fontSize:11, borderRadius:9999,
            display:"inline-flex", alignItems:"center", justifyContent:"center", padding:"0 4px"
          }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position:"absolute", right:0, marginTop:8, width:384, maxHeight:"70vh", overflow:"auto",
          background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, boxShadow:"0 10px 30px rgba(0,0,0,0.12)", padding:8, zIndex:50
        }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 8px" }}>
            <div style={{ fontWeight:600 }}>Notifications</div>
            {unreadIds.length > 0 && (
              <button onClick={handleMarkAll} style={{ fontSize:13, textDecoration:"underline", background:"none", border:"none", cursor:"pointer" }}>
                Mark all as read
              </button>
            )}
          </div>
          <ul style={{ margin:0, padding:0, listStyle:"none" }}>
            {items.length === 0 && (
              <li style={{ padding:16, fontSize:14, color:"#6b7280" }}>No notifications yet</li>
            )}
            {items.map(n => (
              <li key={n.notification_id} style={{ padding:12, background:n.is_read ? "#fff" : "#f9fafb", borderTop:"1px solid #f3f4f6" }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{titleFromType(n.type)}</div>
                <div style={{ fontSize:14, color:"#374151", marginTop:4 }}>{n.message}</div>
                <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>{new Date(n.created_at).toLocaleString()}</div>
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