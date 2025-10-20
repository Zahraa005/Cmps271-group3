import React, { useState, useEffect } from "react";
import { Search, UserPlus, UserCheck, X } from "lucide-react";

export default function FriendsPage() {
  const [tab, setTab] = useState("friends");
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Temporary user ID (Zahraa)
  const currentUserId = 25;

  // ==========================
  // Fetch Friends Data (simulated for artifact)
  // ==========================
  useEffect(() => {
    // Simulated data for artifact display
    const mockFriends = [
      { friend_id: 1, name: "Alice Johnson", sport: "Tennis 🎾", level: "Intermediate", mutual: 3, status: "accepted" },
      { friend_id: 2, name: "John Doe", sport: "Football ⚽", level: "Advanced", mutual: 5, status: "accepted" },
    ];
    const mockRequests = [
      { friend_id: 3, name: "Maya Karam", sport: "Basketball 🏀", level: "Beginner", mutual: 1, status: "pending" }
    ];
    
    setFriends(mockFriends);
    setRequests(mockRequests);
  }, []);

  // ==========================
  // Helpers
  // ==========================
  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleViewProfile = (friendId) => {
    console.log(`View profile: ${friendId}`);
  };

  // ==========================
  // Friend Card Component
  // ==========================
  const FriendCard = ({ person, variant = "default" }) => {
    console.log("Friend data:", person);

    // ✅ Pick the display name safely
    const displayName =
      person.name && person.name.trim() !== ""
        ? person.name
        : person.first_name && person.last_name
        ? `${person.first_name} ${person.last_name}`
        : `User ${person.friend_id}`;

    return (
      <div className="group bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg hover:shadow-fuchsia-900/50 hover:border-fuchsia-800/50 transition-all duration-300 hover:-translate-y-1">
        {/* Avatar + Name */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {getInitials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-indigo-300 font-bold text-lg truncate">
              {displayName}
            </h4>
            <p className="text-sm text-neutral-400">{person.sport || "—"}</p>
          </div>
        </div>

        {/* Level + Mutual */}
        <div className="flex gap-3 text-xs text-neutral-500 mb-4 pb-4 border-b border-neutral-800">
          <span>{person.level || "—"}</span>
          {person.mutual !== undefined && (
            <span>👥 {person.mutual} mutual</span>
          )}
        </div>

        {/* Buttons */}
        {variant === "request" ? (
          <div className="flex gap-2">
            <button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1">
              <UserCheck size={16} /> Accept
            </button>
            <button className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-1">
              <X size={16} /> Decline
            </button>
          </div>
        ) : variant === "suggestion" ? (
          <button className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-600 hover:to-fuchsia-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-fuchsia-500/20">
            <UserPlus size={16} /> Add Friend
          </button>
        ) : (
          <button
            onClick={() => handleViewProfile(person.friend_id)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            View Profile
          </button>
        )}
      </div>
    );
  };

  // ==========================
  // Filters
  // ==========================
  const filteredFriends = friends.filter((f) =>
    (f.name || f.first_name || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredRequests = requests.filter((r) =>
    (r.name || r.first_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredSuggestions = suggestions.filter((s) =>
    (s.name || s.first_name || "").toLowerCase().includes(search.toLowerCase())
  );

  // ==========================
  // Loading & Error UI
  // ==========================
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

  // ==========================
  // Main UI
  // ==========================
  return (
    <div className="min-h-screen bg-neutral-950 relative overflow-hidden text-neutral-100">
      {/* === Background Layers === */}
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

      {/* === Navbar === */}
      <div className="flex justify-between items-center py-5 px-10 relative z-10">
        <div className="flex items-center gap-2 text-2xl font-bold hover:opacity-90 transition-opacity cursor-pointer">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
            PlayConnect
          </span>
          <span>🏀🎾</span>
        </div>

        <div className="flex items-center gap-5">
          <a
            href="/"
            className="text-white hover:text-neutral-100 text-sm transition"
          >
            Back to Home
          </a>
          <a
            href="/dashboard"
            className="text-white hover:text-neutral-100 text-sm transition"
          >
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

      {/* === Header === */}
      <div className="text-center mt-6 mb-10 relative z-10">
        <h2 className="text-4xl font-bold text-fuchsia-300 tracking-wide mb-2">
          Friends
        </h2>
        <p className="text-neutral-400 text-sm">
          Connect and play with your community
        </p>

        <div className="flex justify-center gap-4 mt-6">
          {["friends", "requests", "find"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`px-6 py-2 rounded-lg font-semibold transition-all shadow-md w-36 relative ${
                tab === item
                  ? "bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30"
                  : "bg-gradient-to-r from-indigo-900 to-fuchsia-900 text-indigo-200 hover:from-indigo-700 hover:to-fuchsia-700"
              }`}
            >
              {item === "friends" && "My Friends"}
              {item === "requests" && `Requests (${requests.length})`}
              {item === "find" && "Find Friends"}
            </button>
          ))}
        </div>
      </div>

      {/* === Content === */}
      <div className="max-w-6xl mx-auto px-10 pb-20 relative z-10">
        {/* Search Bar */}
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
                {filteredFriends.map((f) => (
                  <FriendCard key={f.friend_id} person={f} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">No friends found</p>
              </div>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {tab === "requests" && (
          <div>
            <h3 className="text-xl font-semibold mb-6 text-neutral-300">
              Friend Requests ({filteredRequests.length})
            </h3>
            {filteredRequests.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRequests.map((r) => (
                  <FriendCard key={r.friend_id} person={r} variant="request" />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-neutral-400">
                <p className="text-sm">No friend requests</p>
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
                {filteredSuggestions.map((s) => (
                  <FriendCard key={s.friend_id} person={s} variant="suggestion" />
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
    </div>
  );
}