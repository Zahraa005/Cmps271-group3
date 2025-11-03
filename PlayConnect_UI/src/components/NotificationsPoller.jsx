import { useEffect, useRef } from "react";
import { listNotifications, markRead } from "../Api/notifications";
import { pushToast, notifEvents } from "./ToastPortal";

const POLL_MS = 12000; // slower poll so it's calmer
const seen = new Set(); // in-memory dedupe

export default function NotificationsPoller({ userId }) {
  const lastSeenId = useRef(null);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;

    // Pause when tab is hidden
    const onVis = () => {
      if (document.hidden) return;
      // kick a tick when tab refocuses
      tick();
    };
    document.addEventListener("visibilitychange", onVis);

    async function tick() {
      if (stopped.current || document.hidden) {
        // don’t poll while hidden; saves spam and battery
        schedule();
        return;
      }
      try {
        const items = await listNotifications({
          userId,
          unreadOnly: true,
          sinceId: lastSeenId.current,
          limit: 50,
        });

        if (items.length) {
          // advance lastSeenId first
          const maxId = Math.max(...items.map(n => n.notification_id), lastSeenId.current ?? 0);
          lastSeenId.current = maxId;

          for (const n of items) {
            if (seen.has(n.notification_id)) continue; // don’t double-pop
            seen.add(n.notification_id);

            pushToast({ title: prettyTitle(n.type), body: n.message });

            // mark read so it won't come back next poll
            markRead(n.notification_id).catch(() => {});
          }

          notifEvents.bump(); // refresh bell count
        }
      } catch (_) {
        // silent
      } finally {
        schedule();
      }
    }

    function schedule() {
      if (!stopped.current) setTimeout(tick, POLL_MS);
    }

    // initial tick
    tick();

    return () => {
      stopped.current = true;
      document.removeEventListener("visibilitychange", onVis);
    };
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
}
