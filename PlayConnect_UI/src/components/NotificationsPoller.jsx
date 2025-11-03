/*/import { useEffect, useRef } from "react";
import { listNotifications, markRead } from "../Api/notifications";
import ToastPortal, { pushToast, notifEvents } from "./ToastPortal";

const POLL_MS = 5000;

export default function NotificationsPoller({ userId }) {
  const lastSeenId = useRef(null);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;

    async function tick() {
      try {
        const items = await listNotifications({
          userId,
          unreadOnly: true,
          sinceId: lastSeenId.current,
          limit: 50
        });

        for (const n of items) {
          // track max id
          lastSeenId.current = Math.max(lastSeenId.current ?? 0, n.notification_id);
          // pop toast
          pushToast({ title: prettyTitle(n.type), body: n.message });
          // mark read so we don't pop again
          markRead(n.notification_id).catch(() => {});
        }

        if (items.length > 0) notifEvents.bump();
      } catch (_) {
        // silent retry
      } finally {
        if (!stopped.current) setTimeout(tick, POLL_MS);
      }
    }

    tick();
    return () => { stopped.current = true; };
  }, [userId]);

  return null;
}

function prettyTitle(type) {
  switch (type) {
    case "waitlist": return "Waitlist update";
    case "game_update": return "Game update";
    case "game_full": return "Game full";
    case "game_cancelled": return "Game cancelled";
    case "reminder": return "Reminder";
    default: return "Notification";
  }
}/*/
