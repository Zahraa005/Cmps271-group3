import React, { useState, useEffect, useMemo } from "react";
import { Search, UserPlus, UserCheck, X } from "lucide-react";
import ViewProfile from "../components/ViewProfile";


/**
 * HOW WE GET THE LOGGED-IN USER:
 * - Try localStorage "user_id" (set this when you log in)
 * - Fallback to query param ?user_id=... (useful for quick testing)
 * - If still missing, show an error banner
 */
function useCurrentUserId() {
  const fromStorage = Number(localStorage.getItem("user_id"));
  const fromQuery = Number(new URLSearchParams(window.location.search).get("user_id"));
  return Number.isFinite(fromStorage) && fromStorage > 0
    ? fromStorage
    : Number.isFinite(fromQuery) && fromQuery > 0
    ? fromQuery
    : null;
}

// Change this to your API base if needed:
const API_BASE = import.meta?.env?.VITE_API_URL || "http://localhost:8000";

export default function FriendsPage() {
  const [tab, setTab] = useState("friends");
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState([]);          // accepted friends
  const [requests, setRequests] = useState([]);        // incoming requests
  const [sent, setSent] = useState([]);                // pending requests I SENT
  const [suggestions, setSuggestions] = useState([]);  // discover
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // cancel button in-flight
  const [cancelingId, setCancelingId] = useState(null);

  // local toast (top-center bubble)
  const [toast, setToast] = useState(null);

  // --- Profile modal ---
  const [allUsers, setAllUsers] = useState(null);
  const [profileUser, setProfileUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const currentUserId = useCurrentUserId();

  const [showViewProfile, setShowViewProfile] = useState(false);
  const [viewUserId, setViewUserId] = useState(null);
  const [viewInitialUser, setViewInitialUser] = useState(null);

  // ---------- Helpers ----------
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const displayNameOf = (p) => {
    const fn = p.first_name || "";
    const ln = p.last_name || "";
    const name = (fn + " " + ln).trim();
    if (name) return name;
    return p.email || `User ${p.user_id || p.friend_id || "-"}`;
  };

  // ---------- API calls ----------
  async function apiGet(path) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`POST ${path} failed: ${res.status} ${t}`);
    }
    return res.json();
  }

  async function apiPut(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`PUT ${path} failed: ${res.status} ${t}`);
    }
    return res.json();
  }

  async function apiDelete(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`DELETE ${path} failed: ${res.status} ${t}`);
    }
    return res.json().catch(() => ({}));
  }

  // ---------- Normalizers ----------
  const mapEdgeToPerson = (edge) => {
    const f = edge.friend || {};
    return {
      user_id: f.user_id,
      email: f.email,
      first_name: f.first_name,
      last_name: f.last_name,
      avatar_url: f.avatar_url,
      favorite_sport: f.favorite_sport,
      mutual_count: edge.mutual_count ?? undefined,
      status: edge.status,
      created_at: edge.created_at,
    };
  };

  // ---------- Loaders ----------
  async function loadFriends() {
    const data = await apiGet(`/friends/my?user_id=${currentUserId}`);
    setFriends(data.map(mapEdgeToPerson));
  }

  async function loadRequests() {
    const data = await apiGet(`/friends/requests?user_id=${currentUserId}`);
    setRequests(data.map(mapEdgeToPerson));
  }

  async function loadSent() {
    const data = await apiGet(`/friends/sent?user_id=${currentUserId}`);
    setSent(data.map(mapEdgeToPerson));
  }

  async function loadSuggestions() {
    const q = search ? `&query=${encodeURIComponent(search)}` : "";
    const data = await apiGet(`/friends/find?user_id=${currentUserId}${q}`);
    setSuggestions(data);
  }

  // ---------- Actions ----------
  async function onAccept(requesterId) {
    await apiPut(`/friends/status`, {
      user_id: requesterId,
      friend_id: currentUserId,
      status: "accepted",
    });
    await Promise.all([loadRequests(), loadFriends()]);
  }

  async function onDecline(requesterId) {
    await apiPut(`/friends/status`, {
      user_id: requesterId,
      friend_id: currentUserId,
      status: "rejected",
    });
    await loadRequests();
  }

  async function onAddFriend(targetId) {
    await apiPost(`/friends`, {
      user_id: currentUserId,
      friend_id: targetId,
    });
    await Promise.all([loadSuggestions(), loadRequests(), loadSent()]);
  }

  async function onCancelPending(targetId) {
    if (!targetId) return;
    const ok = window.confirm("Cancel this friend request?");
    if (!ok) return;

    try {
      setCancelingId(targetId);
      await apiDelete(`/friends?user_id=${currentUserId}&friend_id=${targetId}`);
      setToast("Request canceled");
      await Promise.all([loadSent(), loadSuggestions()]);
    } catch (e) {
      console.error(e);
      setToast("Failed to cancel request");
    } finally {
      setCancelingId(null);
    }
  }

  // ---------- View Profile ----------
  const handleViewProfile = async (friendUserId) => {
    setShowProfileModal(true);
    setProfileLoading(true);
    try {
      let list = allUsers;
      if (!list) {
        list = await apiGet("/users");
        setAllUsers(list);
      }
      const u = list.find((u) => u.user_id === friendUserId);
      setProfileUser(u || null);
    } catch (e) {
      console.error(e);
      setProfileUser(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // ---------- Effects ----------
  useEffect(() => {
    if (!currentUserId) {
      setError("Missing logged-in user_id. Add it to localStorage or as ?user_id=123");
      return;
    }
    setError("");
  }, [currentUserId]);

  // Preload /users once for the profile modal
  useEffect(() => {
    (async () => {
      try {
        const users = await apiGet("/users");
        setAllUsers(users);
      } catch (e) {
        console.warn("Failed to preload /users", e);
      }
    })();
  }, []);

  // auto-hide toast after 3s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load when tab changes
  const debouncedSearch = useMemo(() => search, [search]);
  useEffect(() => {
    if (!currentUserId) return;

    setLoading(true);
    const load = async () => {
      try {
        if (tab === "friends") {
          await loadFriends();
        } else if (tab === "requests") {
          await loadRequests();
        } else if (tab === "pending") {
          await loadSent();
        } else {
          await loadSuggestions();
        }
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentUserId]);

  // Refetch suggestions when searching in Find tab
  useEffect(() => {
    if (!currentUserId) return;
    if (tab !== "find") return;
    const t = setTimeout(() => {
      loadSuggestions().catch((e) => setError(e.message || String(e)));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, tab, currentUserId]);

  // ---------- Friend Card ----------
  const FriendCard = ({ person, variant = "default", onAcceptClick, onDeclineClick, onAddClick, onCancelClick }) => {
    const displayName =
      person.name && person.name.trim() !== ""
        ? person.name
        : displayNameOf(person);

    const sportText = person.favorite_sport || person.sport || "—";
    const isCanceling = cancelingId === person.user_id;

    return (
      <div className="group bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg hover:shadow-fuchsia-900/50 hover:border-fuchsia-800/50 transition-all duration-300 hover:-translate-y-1">
        {/* Avatar + Name */}
          <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
            {person.avatar_url ? (
              <img
                src={person.avatar_url}
                alt={displayName}
                className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition"
                onClick={() => {
                  setViewUserId(person.user_id);
                  setViewInitialUser(person);
                  setShowViewProfile(true);
                }}
              />
            ) : (
              <div
                onClick={() => {
                  setViewUserId(person.user_id);
                  setViewInitialUser(person);
                  setShowViewProfile(true);
                }}
                className="w-full h-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:opacity-80 transition"
              >
                {getInitials(displayName)}
              </div>
            )}

          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-indigo-300 font-bold text-lg truncate">
              {displayName}
            </h4>
            <p className="text-sm text-neutral-400">{sportText}</p>
          </div>
        </div>

        {/* Status strip */}
        <div className="flex gap-3 text-xs text-neutral-500 mb-4 pb-4 border-b border-neutral-800">
          {variant === "default" && <span>🤝 Connected</span>}
          {variant === "request" && <span>📩 Incoming request</span>}
          {variant === "pendingSent" && <span>⏳ Pending</span>}
          {variant === "suggestion" && Number.isFinite(person.mutual_count) && (
            <span>👥 {person.mutual_count} mutual</span>
          )}
        </div>

        {/* Buttons */}
        {variant === "request" ? (
          <div className="flex gap-2">
            <button
              onClick={onAcceptClick}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"
            >
              <UserCheck size={16} /> Accept
            </button>
            <button
              onClick={onDeclineClick}
              className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1"
            >
              <X size={16} /> Decline
            </button>
          </div>
        ) : variant === "pendingSent" ? (
          <button
            onClick={onCancelClick}
            disabled={isCanceling}
            className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
              isCanceling
                ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
            }`}
          >
            {isCanceling ? "Canceling..." : "Cancel Request"}
          </button>
        ) : variant === "suggestion" ? (
          <button
            onClick={onAddClick}
            className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-600 hover:to-fuchsia-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-fuchsia-500/20"
          >
            <UserPlus size={16} /> Add Friend
          </button>
        ) : (
          <button
            onClick={() => handleViewProfile(person.user_id)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            View Profile
          </button>
        )}
      </div>
    );
  };

  // ---------- Filters (client-side search) ----------
  const filteredFriends = friends.filter((f) =>
    displayNameOf(f).toLowerCase().includes(search.toLowerCase())
  );
  const filteredRequests = requests.filter((r) =>
    displayNameOf(r).toLowerCase().includes(search.toLowerCase())
  );
  const filteredSuggestions = suggestions.filter((s) =>
    displayNameOf(s).toLowerCase().includes(search.toLowerCase())
  );
  const filteredSent = sent.filter((s) =>
    displayNameOf(s).toLowerCase().includes(search.toLowerCase())
  );

  // ---------- Loading & Error ----------
  if (loading)
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        Loading friends...
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-red-400">
        {error}
      </div>
    );

  if (!currentUserId)
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-yellow-400">
        Missing user_id. Save it in localStorage or pass ?user_id=ME
      </div>
    );

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-neutral-950 relative overflow-hidden text-neutral-100">
      {/* Background Layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(600px 300px at 20% 0%, rgba(167,139,250,0.18), transparent 60%), radial-gradient(600px 300px at 80% 100%, rgba(244,114,182,0.14), transparent 55%)",
        }}
      />

      {/* Navbar */}
      <div className="flex justify-between items-center py-5 px-10 relative z-10">
        <div className="flex items-center gap-2 text-2xl font-bold hover:opacity-90 transition-opacity cursor-pointer">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
            PlayConnect
          </span>
          <span>🏀🎾</span>
        </div>

        <div className="flex items-center gap-5">
          <a href="/" className="text-white hover:text-neutral-100 text-sm transition">
            Back to Home
          </a>
          <a href="/dashboard" className="text-white hover:text-neutral-100 text-sm transition">
            Dashboard
          </a>
          <button
            onClick={() => (window.location.href = "/")}
            className="bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg font-semibold text-sm transition text-white"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="text-center mt-6 mb-10 relative z-10">
        <h2 className="text-4xl font-bold text-fuchsia-300 tracking-wide mb-2">Friends</h2>
        <p className="text-neutral-400 text-sm">Connect and play with your community</p>

        <div className="flex justify-center gap-3 mt-6 flex-wrap">
          {["friends", "requests", "pending", "find"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`px-5 py-2 rounded-lg font-semibold transition-all shadow-md relative ${
                tab === item
                  ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30"
                  : "bg-gradient-to-r from-indigo-900 to-fuchsia-900 text-indigo-200 hover:from-indigo-700 hover:to-fuchsia-700"
              }`}
            >
              {item === "friends" && "My Friends"}
              {item === "requests" && `Incoming (${filteredRequests.length})`}
              {item === "pending" && `Pending (${filteredSent.length})`}
              {item === "find" && "Find Friends"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-10 pb-20 relative z-10">
        {/* Search */}
        <div className="mb-8 flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 hover:border-neutral-700 transition max-w-sm mx-auto">
          <Search size={18} className="text-neutral-500" />
          <input
            type="text"
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none flex-1 text-neutral-100 placeholder-neutral-600 text-sm"
          />
        </div>

        {/* Friends Tab */}
        {tab === "friends" && (
          <div>
            <h3 className="text-xl font-semibold mb-6 text-neutral-300">
              My Friends ({filteredFriends.length})
            </h3>
            {filteredFriends.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFriends.map((p) => (
                  <FriendCard key={p.user_id} person={p} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">No friends found</p>
              </div>
            )}
          </div>
        )}

        {/* Incoming Requests Tab */}
        {tab === "requests" && (
          <div>
            <h3 className="text-xl font-semibold mb-6 text-neutral-300">
              Incoming Friend Requests ({filteredRequests.length})
            </h3>
            {filteredRequests.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRequests.map((p) => (
                  <FriendCard
                    key={p.user_id}
                    person={p}
                    variant="request"
                    onAcceptClick={() => onAccept(p.user_id)}
                    onDeclineClick={() => onDecline(p.user_id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">No incoming friend requests</p>
              </div>
            )}
          </div>
        )}

        {/* Pending (Sent) Requests Tab */}
        {tab === "pending" && (
          <div>
            <h3 className="text-xl font-semibold mb-6 text-neutral-300">
              Pending Requests (Sent) ({filteredSent.length})
            </h3>
            {filteredSent.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSent.map((p) => (
                  <FriendCard
                    key={p.user_id}
                    person={p}
                    variant="pendingSent"
                    onCancelClick={() => onCancelPending(p.user_id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">No pending requests</p>
              </div>
            )}
          </div>
        )}

        {/* Find Friends Tab */}
        {tab === "find" && (
          <div>
            <h3 className="text-xl font-semibold mb-6 text-neutral-300">
              Find New Friends ({filteredSuggestions.length})
            </h3>
            {filteredSuggestions.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSuggestions.map((p) => (
                  <FriendCard
                    key={p.user_id}
                    person={p}
                    variant="suggestion"
                    onAddClick={() => onAddFriend(p.user_id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">No suggestions available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast (top-center) */}
      {toast && (
        <div className="fixed left-1/2 top-4 -translate-x-1/2 rounded-full bg-neutral-900 border border-neutral-700 px-4 py-2 text-sm text-neutral-100 shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="absolute top-3 right-3 text-neutral-400 hover:text-white text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>

            <h3 className="text-lg font-semibold text-white mb-4">Profile</h3>

            {profileLoading ? (
              <div className="py-8 flex items-center justify-center">
                <svg className="h-5 w-5 animate-spin text-neutral-300" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              </div>
            ) : profileUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    {profileUser.avatar_url ? (
                      <img
                        src={profileUser.avatar_url}
                        alt="avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm">
                        {getInitials(
                          `${profileUser.first_name || ""} ${profileUser.last_name || ""}`.trim() ||
                          profileUser.email ||
                          `User ${profileUser.user_id ?? ""}`
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">
                      {`${profileUser.first_name || ""} ${profileUser.last_name || ""}`.trim() ||
                        profileUser.email ||
                        `User ${profileUser.user_id ?? ""}`}
                    </div>
                    <div className="text-neutral-400 text-sm truncate">
                      {profileUser.favorite_sport || "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-neutral-300 text-sm mb-1">Bio</div>
                  <div className="p-3 bg-neutral-800 rounded-lg text-neutral-100 text-sm">
                    {profileUser.bio && profileUser.bio.trim().length > 0
                      ? profileUser.bio
                      : "No bio available"}
                  </div>
                </div>

                <button
                  onClick={() => setShowProfileModal(false)}
                  className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-neutral-400 text-sm">Failed to load profile.</p>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="mt-3 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg text-sm"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {showViewProfile && (
        <ViewProfile
          userId={viewUserId}
          initialUser={viewInitialUser}
          currentUserId={currentUserId}
          onClose={() => setShowViewProfile(false)}
        />
      )}
    </div>
  );
}
