import API_BASE_URL from "./config";

export async function listNotifications({ userId, unreadOnly = false, sinceId = null, limit = 20 }) {
  const p = new URLSearchParams({ user_id: String(userId) });
  if (unreadOnly) p.set("unread_only", "true");
  if (sinceId !== null && sinceId !== undefined) p.set("since_id", String(sinceId));
  p.set("limit", String(limit));
  const res = await fetch(`${API_BASE_URL}/notifications?${p.toString()}`);
  if (!res.ok) throw new Error(`listNotifications ${res.status}`);
  return res.json();
}

export async function unreadCount(userId) {
  const res = await fetch(`${API_BASE_URL}/notifications/unread_count?user_id=${userId}`);
  if (!res.ok) throw new Error(`unreadCount ${res.status}`);
  const d = await res.json();
  return Number(d.unread_count || 0);
}

export async function markRead(id) {
  const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: "PATCH" });
  if (!res.ok) throw new Error(`markRead ${res.status}`);
}

export async function markAllRead(ids) {
  await Promise.all(ids.map(id => markRead(id).catch(() => {})));
}