import API_BASE_URL from "./config";

// GET /game-instances/:gameId/waitlist  ->  [{ user_id, name, joined_at }, ...]
export async function getWaitlist(gameId) {
  const res = await fetch(`${API_BASE_URL}/game-instances/${gameId}/waitlist`);
  if (!res.ok) throw new Error(`Failed to fetch waitlist: ${res.status}`);
  return res.json();
}

// POST /game-instances/:gameId/waitlist  { user_id }
export async function joinWaitlist(gameId, userId) {
  const res = await fetch(`${API_BASE_URL}/game-instances/${gameId}/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(`Failed to join waitlist: ${res.status}`);
  return res.json();
}

// DELETE /game-instances/:gameId/waitlist/:userId
export async function leaveWaitlist(gameId, userId) {
  const res = await fetch(`${API_BASE_URL}/game-instances/${gameId}/waitlist/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to leave waitlist: ${res.status}`);
  return res.json();
}