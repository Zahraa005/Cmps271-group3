import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

let pushFn = null;
export function pushToast(t) { if (pushFn) pushFn(t); }

// event to tell the bell “unread changed”
export const notifEvents = {
  bump() { window.dispatchEvent(new CustomEvent("notif:bump")); }
};

export default function ToastPortal() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    pushFn = (t) => {
      const toast = { id: Date.now() + Math.random(), ...t };
      setToasts(prev => [toast, ...prev]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== toast.id)), 6000);
    };
    return () => { pushFn = null; };
  }, []);

  return createPortal(
    <div style={{ position:"fixed", top:16, right:16, zIndex:9999, display:"flex", flexDirection:"column", gap:12 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ maxWidth:360, border:"1px solid #e5e7eb", background:"#fff", borderRadius:16, boxShadow:"0 6px 22px rgba(0,0,0,0.12)", padding:14 }}>
          <div style={{ fontWeight:600 }}>{t.title || "Notification"}</div>
          {t.body ? <div style={{ fontSize:14, color:"#4b5563", marginTop:4 }}>{t.body}</div> : null}
        </div>
      ))}
    </div>,
    document.body
  );
}
