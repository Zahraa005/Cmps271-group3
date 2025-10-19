import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import MatchHistoryPanel from "../components/MatchHistoryPanel";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function DashboardPage() {
  const [games, setGames] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  // Edit state
  const [editingGame, setEditingGame] = useState(null); // holds the game being edited

  // Waitlist state
  const [waitlists, setWaitlists] = useState({});           // { [gameId]: [{user_id, name, joined_at}, ...] }
  const [waitlistLoading, setWaitlistLoading] = useState({});// { [gameId]: boolean }
  const [waitlistError, setWaitlistError] = useState({});    // { [gameId]: string }
  // Participants state
  const [participantsCounts, setParticipantsCounts] = useState({}); // { [gameId]: number }
  const [joiningGameId, setJoiningGameId] = useState(null);
  const [leavingGameId, setLeavingGameId] = useState(null);
  const [iAmInGame, setIAmInGame] = useState({}); // { [gameId]: boolean }


  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // Form state for creating new games
  const [formData, setFormData] = useState({
    host_id: 0, // Will be set from authenticated user
    sport_id: 0, // Will be set when sports are loaded
    start_time: "",
    duration_minutes: 60,
    location: "",
    skill_level: "Beginner",
    max_players: 8,
    cost: 0,
    status: "Open", // Required field for API
    notes: ""
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  //Dashboard Filters
  const [sportFilter, setSportFilter] = useState("");           // number or ""
  const [statusFilter, setStatusFilter] = useState("");         // "Open" | "Full" | "Cancelled" | ""
  const [skillFilter, setSkillFilter] = useState("");           // "Beginner" | "Intermediate" | "Advanced" | ""
  const [fromISO, setFromISO] = useState("");                   // ISO string or ""
  const [toISO, setToISO] = useState("");                       // ISO string or ""
  const [spotsFilter, setSpotsFilter] = useState("");           // "available" | "full" | ""
  const [sort, setSort] = useState("start_time:asc");           // backend whitelist
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Toast cleanup
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch games and sports on component mount
  useEffect(() => {
    fetchGames();
    fetchSports();
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Set default sport_id when sports are loaded
  useEffect(() => {
    if (sports.length > 0 && formData.sport_id === 0) {
      setFormData(prev => ({ ...prev, sport_id: sports[0].sport_id }));
    }
  }, [sports, formData.sport_id]);

  // Set user ID when user is loaded
  useEffect(() => {
    if (user && formData.host_id === 0) {
      setFormData(prev => ({ ...prev, host_id: user.user_id }));
    }
  }, [user, formData.host_id]);

  // Re-fetch when any filter or paging changes
useEffect(() => {
  fetchGames();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sportFilter, statusFilter, skillFilter, fromISO, toISO, spotsFilter, sort, page, pageSize, searchText]);


  //I replaced fetchGames() to call /dashboard/games
  const fetchGames = async () => {
    try {
      setLoading(true);

      // Build query params (send only non-empty)
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      params.set("sort", sort);

      if (sportFilter) params.set("sport_id", String(sportFilter));
      if (statusFilter) params.set("status", statusFilter);
      if (skillFilter) params.set("skill_level", skillFilter);
      if (fromISO) params.set("from_", fromISO);   // NOTE: from_ with underscore
      if (toISO) params.set("to", toISO);
      if (spotsFilter) params.set("spots", spotsFilter);
      if (searchText.trim()) params.set("search", searchText.trim());

      const response = await fetch(`${API_BASE}/dashboard/games?${params.toString()}`);
      if (!response.ok) {
        setToast("Failed to fetch games");
        setGames([]);
        setTotal(0);
        setHasNext(false);
        return;
      }

      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setGames(items);
      setTotal(Number(data?.total || 0));
      setHasNext(Boolean(data?.has_next));

      // After games load, fetch participant info for each (keeps your existing counters)
      await fetchAllParticipantsInfo(items);
    } catch (error) {
      console.error("Error fetching games:", error);
      setToast("Failed to fetch games");
      setGames([]);
      setTotal(0);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  };


  const fetchSports = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/sports');
      if (response.ok) {
        const data = await response.json();
        setSports(data);
      } else {
        console.error('Failed to fetch sports');
        setToast("Failed to fetch sports");
      }
    } catch (error) {
      console.error('Error fetching sports:', error);
      setToast("Failed to fetch sports");
    }
  };

  // ===== Waitlist helpers =====
  const API_BASE = import.meta.env?.VITE_API_URL || "http://127.0.0.1:8000";

  // ===== Participants helpers =====
  async function fetchParticipantsInfo(gameId) {
    try {
      const res = await fetch(`${API_BASE}/game-participants?game_id=${encodeURIComponent(gameId)}`);
      if (!res.ok) throw new Error(`Failed to fetch participants (${res.status})`);
      const list = await res.json();
      const count = Array.isArray(list) ? list.length : 0;
      setParticipantsCounts(prev => ({ ...prev, [gameId]: count }));
      setIAmInGame(prev => ({ ...prev, [gameId]: Array.isArray(list) && user ? list.some(p => String(p.user_id) === String(user.user_id)) : false }));
    } catch (e) {
      // Keep silent but log
      console.error(e);
      setParticipantsCounts(prev => ({ ...prev, [gameId]: prev[gameId] ?? 0 }));
      setIAmInGame(prev => ({ ...prev, [gameId]: prev[gameId] ?? false }));
    }
  }

  async function fetchAllParticipantsInfo(gamesList) {
    const ids = (gamesList || games).map(g => g.game_id);
    await Promise.all(ids.map(id => fetchParticipantsInfo(id)));
  }

  async function joinGame(gameId) {
    if (!user) {
      setToast("Please login to join");
      return;
    }
    try {
      setJoiningGameId(gameId);
      const res = await fetch(`${API_BASE}/game-participants/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, user_id: user.user_id, role: "PLAYER" })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Join failed (${res.status})`);
      }
      const payload = await res.json();
      setToast(payload?.message || "Joined game");
      // Refresh participant info for this game
      await fetchParticipantsInfo(gameId);
      // Optionally update game status to Full if count >= max_players
      setGames(prev => prev.map(g => {
        if (g.game_id !== gameId) return g;
        const newCount = (participantsCounts[gameId] ?? 0) + 1; // optimistic
        return { ...g, status: newCount >= g.max_players ? "Full" : g.status };
      }));
    } catch (e) {
      setToast(e.message || "Failed to join game");
    } finally {
      setJoiningGameId(null);
    }
  }

  async function leaveGame(gameId) {
    if (!user) {
      setToast("Please login to leave");
      return;
    }
    if (!window.confirm("Are you sure you want to leave ?")) {
      return;
    }
    try {
      setLeavingGameId(gameId);
      const res = await fetch(`${API_BASE}/game-participants/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, user_id: user.user_id })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Leave failed (${res.status})`);
      }
      const payload = await res.json();
      setToast(payload?.message || "Left game");
      // Refresh participant info for this game
      await fetchParticipantsInfo(gameId);
      // Optionally update game status away from Full if capacity available
      setGames(prev => prev.map(g => {
        if (g.game_id !== gameId) return g;
        const newCount = Math.max((participantsCounts[gameId] ?? 1) - 1, 0); // optimistic
        return { ...g, status: newCount >= g.max_players ? "Full" : (g.status === "Full" ? "Open" : g.status) };
      }));
    } catch (e) {
      setToast(e.message || "Failed to leave game");
    } finally {
      setLeavingGameId(null);
    }
  }

  async function fetchWaitlist(gameId) {
    try {
      setWaitlistLoading(prev => ({ ...prev, [gameId]: true }));
      setWaitlistError(prev => ({ ...prev, [gameId]: "" }));
      const res = await fetch(`${API_BASE}/game-instances/${gameId}/waitlist`);
      if (!res.ok) throw new Error(`Failed to fetch waitlist (${res.status})`);
      const data = await res.json();
      setWaitlists(prev => ({ ...prev, [gameId]: Array.isArray(data) ? data : [] }));
    } catch (e) {
      setWaitlistError(prev => ({ ...prev, [gameId]: e.message || "Failed to load waitlist" }));
    } finally {
      setWaitlistLoading(prev => ({ ...prev, [gameId]: false }));
    }
  }

  async function joinWaitlist(gameId, userId) {
    try {
      const res = await fetch(`${API_BASE}/game-instances/${gameId}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) throw new Error(`Join failed (${res.status})`);
      await fetchWaitlist(gameId);
      setToast("Joined queue");
    } catch (e) {
      setToast(e.message || "Failed to join queue");
    }
  }

  async function leaveWaitlist(gameId, userId) {
    try {
      const res = await fetch(`${API_BASE}/game-instances/${gameId}/waitlist/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Leave failed (${res.status})`);
      await fetchWaitlist(gameId);
      setToast("Left queue");
    } catch (e) {
      setToast(e.message || "Failed to leave queue");
    }
  }
  // Handle Delete Game Instances
  const handleDeleteGame = async (gameId) => {
    if (!window.confirm("Are you sure you want to delete this game?")) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/game-instances/${gameId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Remove game from state so it disappears instantly
        setGames(games.filter(g => g.game_id !== gameId));
        setToast("Game deleted successfully!");
      } else {
        const errorData = await response.json();
        setToast(`Failed to delete: ${errorData.detail || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error deleting game:", error);
      setToast("Error deleting game");
    }
  };
  // Handle Editing Game Instances
  const handleUpdateGame = async (e) => {
    e.preventDefault();
    if (!editingGame) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/game-instances/${editingGame.game_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingGame),
      });

      if (response.ok) {
        const updated = await response.json();
        // update local state
        setGames(games.map(g => g.game_id === updated.game_id ? updated : g));
        setToast("Game updated successfully!");
        setEditingGame(null); // close modal
      } else {
        const errorData = await response.json();
        setToast(`Failed to update: ${errorData.detail || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error updating game:", error);
      setToast("Error updating game");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'sport_id' || name === 'duration_minutes' || name === 'max_players' || name === 'cost' || name === 'host_id'
        ? parseInt(value) || 0
        : value
    }));

    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.start_time) errors.start_time = "Start time is required";
    if (!formData.location.trim()) errors.location = "Location is required";
    if (formData.duration_minutes < 15) errors.duration_minutes = "Duration must be at least 15 minutes";
    if (formData.max_players < 2) errors.max_players = "Must allow at least 2 players";
    if (formData.cost < 0) errors.cost = "Cost cannot be negative";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormLoading(true);
    try {
      // Prepare the data in the exact format expected by the API
      const apiData = {
        host_id: formData.host_id,
        sport_id: formData.sport_id,
        start_time: formData.start_time, // Should be ISO string format
        duration_minutes: formData.duration_minutes,
        location: formData.location,
        skill_level: formData.skill_level,
        max_players: formData.max_players,
        cost: formData.cost,
        status: formData.status,
        notes: formData.notes
      };

      console.log('Sending data to API:', apiData); // Debug log

      const response = await fetch('http://127.0.0.1:8000/game-instances', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });

      if (response.ok) {
        setToast("Game created successfully!");
        setShowCreateForm(false);
        setFormData({
          host_id: user ? user.user_id : 0,
          sport_id: sports.length > 0 ? sports[0].sport_id : 0,
          start_time: "",
          duration_minutes: 60,
          location: "",
          skill_level: "Beginner",
          max_players: 8,
          cost: 0,
          status: "Open",
          notes: ""
        });
        fetchGames(); // Refresh the games list
      } else {
        const errorData = await response.json();
        setToast(`Failed to create game: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating game:', error);
      setToast("Failed to create game");
    } finally {
      setFormLoading(false);
    }
  };

  const formatDateTime = (dateTimeStr) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getSportName = (sportId) => {
    const sport = sports.find(s => s.sport_id === sportId);
    return sport ? sport.name : `Sport ${sportId}`;
  };

  const getSkillLevelColor = (level) => {
    switch (level) {
      case "Beginner": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Intermediate": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Advanced": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Open": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Full": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "Cancelled": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-neutral-500/20 text-neutral-400 border-neutral-500/30";
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 relative overflow-hidden">
      {/* Background patterns - matching LoginPage */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 0 0",
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

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-5 mix-blend-overlay"
        style={{
          backgroundImage:
            "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nNScgaGVpZ2h0PSc1JyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjxmaWx0ZXIgaWQ9J2EnPjxmZVR1cmJ1bGVuY2UgdHlwZT0ncGVybGluJyBiYXNlRnJlcXVlbmN5PScwLjcnIG51bU9jdGF2ZXM9JzInLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nNTAnIGhlaWdodD0nNTAnIGZpbHRlcj0ndXJsKCNhKScgZmlsbD0nI2ZmZicvPjwvc3ZnPg==')",
          backgroundSize: "150px 150px",
        }}
      />

      {/* Navigation */}
      {/* Dashboard Header */}
      <>
        {/* Background patterns */}
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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-5 mix-blend-overlay"
          style={{
            backgroundImage:
              "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nNScgaGVpZ2h0PSc1JyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnPjxmaWx0ZXIgaWQ9J2EnPjxmZVR1cmJ1bGVuY2UgdHlwZT0ncGVybGluJyBiYXNlRnJlcXVlbmN5PScwLjcnIG51bU9jdGF2ZXM9JzInLz48L2ZpbHRlcj48cmVjdCB3aWR0aD0nNTAnIGhlaWdodD0nNTAnIGZpbHRlcj0ndXJsKCNhKScgZmlsbD0nI2ZmZicvPjwvc3ZnPg==')",
            backgroundSize: "150px 150px",
          }}
        />

        {/* Navigation */}
        <div className="px-4 py-4 relative z-10">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2 text-2xl font-bold text-white">
              <a href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
                <span>PlayConnect</span>
                <span>🏀🎾</span>
              </a>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                &larr; Back to Home
              </a>

              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg transition-colors"
              >
                {showCreateForm ? "Cancel" : "Create Game"}
              </button>

              <button
                onClick={logout}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
              >
                Logout
              </button>

              {/* Profile Circle */}
              <div
                title={user?.first_name ? `${user.first_name} ${user.last_name || ""}` : user?.email}
                className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white font-semibold text-sm hover:bg-neutral-700 cursor-default"
              >
                {user
                  ? user.first_name
                    ? user.first_name.charAt(0).toUpperCase()
                    : user.email?.charAt(0).toUpperCase()
                  : "👤"}
              </div>
            </div>
          </div>
        </div>
      </>


      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="text-center mb-10">
          <h2 className="text-3xl font-semibold text-white mb-2">
            Game Dashboard
          </h2>
          <p className="text-neutral-400 text-sm">
            Discover and join upcoming games in your area
          </p>
          {user && (
            <p className="text-4xl text-violet-400 mt-1">
              Welcome back,{" "}
              {user.first_name
                ? `${user.first_name} ${user.last_name ?? ""}`.trim()
                : user.email}
              !
            </p>
          )}

          {/* Decorative refresh line */}
          <div className="mt-5 flex items-center justify-center">
            <div className="flex-grow max-w-xs h-[1px] bg-gradient-to-r from-transparent via-neutral-700 to-transparent"></div>
            <button
              onClick={fetchGames}
              disabled={loading}
              className="mx-3 px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md text-sm disabled:opacity-50 transition"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <div className="flex-grow max-w-xs h-[1px] bg-gradient-to-r from-transparent via-neutral-700 to-transparent"></div>
          </div>
        </header>

        {user && (
          <div className="mt-10">
            <MatchHistoryPanel userId={user.user_id} />
          </div>
        )}

        {/* Create Game Form */}
        {showCreateForm && (
          <div className="mb-8 max-w-2xl mx-auto">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Create New Game</h2>
              <form onSubmit={handleCreateGame} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1 text-white">Sport</label>
                    <select
                      name="sport_id"
                      value={formData.sport_id}
                      onChange={handleInputChange}
                      className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      disabled={formLoading}
                    >
                      {sports.map((sport) => (
                        <option key={sport.sport_id} value={sport.sport_id}>
                          {sport.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-white">Start Time</label>
                    <input
                      type="datetime-local"
                      name="start_time"
                      value={formData.start_time}
                      onChange={handleInputChange}
                      className={classNames(
                        "w-full rounded-lg bg-neutral-950/70 border px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent",
                        formErrors.start_time ? "border-red-500" : "border-neutral-800"
                      )}
                      disabled={formLoading}
                    />
                    {formErrors.start_time && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.start_time}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-white">Duration (minutes)</label>
                    <input
                      type="number"
                      name="duration_minutes"
                      value={formData.duration_minutes}
                      onChange={handleInputChange}
                      min="15"
                      className={classNames(
                        "w-full rounded-lg bg-neutral-950/70 border px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent",
                        formErrors.duration_minutes ? "border-red-500" : "border-neutral-800"
                      )}
                      disabled={formLoading}
                    />
                    {formErrors.duration_minutes && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.duration_minutes}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-white">Location</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Enter location"
                      className={classNames(
                        "w-full rounded-lg bg-neutral-950/70 border px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent",
                        formErrors.location ? "border-red-500" : "border-neutral-800"
                      )}
                      disabled={formLoading}
                    />
                    {formErrors.location && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.location}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-white">Skill Level</label>
                    <select
                      name="skill_level"
                      value={formData.skill_level}
                      onChange={handleInputChange}
                      className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      disabled={formLoading}
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-white">Max Players</label>
                    <input
                      type="number"
                      name="max_players"
                      value={formData.max_players}
                      onChange={handleInputChange}
                      min="2"
                      className={classNames(
                        "w-full rounded-lg bg-neutral-950/70 border px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent",
                        formErrors.max_players ? "border-red-500" : "border-neutral-800"
                      )}
                      disabled={formLoading}
                    />
                    {formErrors.max_players && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.max_players}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm mb-1 text-white">Cost ($)</label>
                    <input
                      type="number"
                      name="cost"
                      value={formData.cost}
                      onChange={handleInputChange}
                      min="0"
                      step="0.01"
                      className={classNames(
                        "w-full rounded-lg bg-neutral-950/70 border px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent",
                        formErrors.cost ? "border-red-500" : "border-neutral-800"
                      )}
                      disabled={formLoading}
                    />
                    {formErrors.cost && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.cost}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1 text-white">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Additional notes (optional)"
                    rows="3"
                    className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                    disabled={formLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={formLoading}
                  className={classNames(
                    "w-full rounded-xl py-3 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
                    formLoading
                      ? "bg-neutral-800/80 text-neutral-500 cursor-not-allowed"
                      : "bg-violet-500 text-white hover:bg-violet-400 active:scale-[0.99] shadow-lg shadow-violet-500/30"
                  )}
                >
                  {formLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Creating Game...
                    </div>
                  ) : (
                    "Create Game"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
        {/* Filter Bar */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white"
            placeholder="Search location/notes"
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
          />

          <select
            className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white"
            value={sportFilter}
            onChange={(e) => { setSportFilter(e.target.value); setPage(1); }}
          >
            <option value="">All sports</option>
            {sports.map(s => (
              <option key={s.sport_id} value={s.sport_id}>{s.name}</option>
            ))}
          </select>

            <select
              className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">Any status</option>
              <option value="Open">Open</option>
              <option value="Full">Full</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <select
              className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white"
              value={skillFilter}
              onChange={(e) => { setSkillFilter(e.target.value); setPage(1); }}
            >
              <option value="">Any skill</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>

            <input
              type="datetime-local"
              className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white"
              value={fromISO ? fromISO.slice(0,16) : ""}
              onChange={(e) => { setFromISO(e.target.value ? new Date(e.target.value).toISOString() : ""); setPage(1); }}
            />
            <input
              type="datetime-local"
              className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white"
              value={toISO ? toISO.slice(0,16) : ""}
              onChange={(e) => { setToISO(e.target.value ? new Date(e.target.value).toISOString() : ""); setPage(1); }}
            />

            <select
              className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white"
              value={spotsFilter}
              onChange={(e) => { setSpotsFilter(e.target.value); setPage(1); }}
            >
              <option value="">Any spots</option>
              <option value="available">Spots available</option>
              <option value="full">Full</option>
            </select>

            <select
              className="w-full rounded-lg bg-neutral-950/70 border border-neutral-800 px-3 py-2 text-white"
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
            >
              <option value="start_time:asc">Start time ↑</option>
              <option value="start_time:desc">Start time ↓</option>
              <option value="created_at:asc">Created ↑</option>
              <option value="created_at:desc">Created ↓</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => { 
                  setSportFilter(""); setStatusFilter(""); setSkillFilter("");
                  setFromISO(""); setToISO(""); setSpotsFilter(""); setSort("start_time:asc");
                  setSearchText(""); setPage(1); setPageSize(12);
                }}
                className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg"
              >
                Clear
              </button>
              <button
                onClick={() => fetchGames()}
                className="flex-1 px-4 py-2 bg-violet-500 hover:bg-violet-400 text-white rounded-lg"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Paging controls (simple) */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-800 text-white"
              disabled={page === 1 || loading}
            >
              Prev
            </button>
            <span className="text-sm text-neutral-400">Page {page}</span>
            <button
              onClick={() => hasNext && setPage(p => p + 1)}
              className="px-3 py-1 rounded border border-neutral-700 hover:bg-neutral-800 text-white"
              disabled={!hasNext || loading}
            >
              Next
            </button>

            <select
              className="ml-3 px-2 py-1 rounded border border-neutral-700 bg-neutral-900 text-white"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {[12, 24, 48].map(s => <option key={s} value={s}>{s}/page</option>)}
            </select>

            <span className="ml-auto text-sm text-neutral-400">{total} games</span>
          </div>

        {/* Games List */}
        <div className="space-y-6">


          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-neutral-400">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Loading games...
              </div>
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-neutral-400 mb-4">
                <svg className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No games found</h3>
              <p className="text-neutral-400">Be the first to create a game!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game) => (
                <>
                  {game.status === "Full" && !waitlists[game.game_id] && !waitlistLoading[game.game_id] && fetchWaitlist(game.game_id)}
                  <div
                    key={game.game_id}

                    className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 hover:border-neutral-700 transition-colors flex flex-col"
                  >

                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{getSportName(game.sport_id)}</h3>
                        <p className="text-sm text-neutral-400">{formatDateTime(game.start_time)}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className={classNames(
                          "px-2 py-1 rounded-full text-xs font-medium border",
                          getStatusColor(game.status)
                        )}>
                          {game.status}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-neutral-300">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{game.location}</span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-neutral-300">
                        <div className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                          <span>Max {game.max_players} players</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-3m-4 6H7v-2a4 4 0 014-4h0m6-8a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span>
                            {(participantsCounts[game.game_id] ?? 0)} / {game.max_players} joined
                          </span>
                          <button
                            onClick={() => fetchParticipantsInfo(game.game_id)}
                            className="ml-2 text-xs px-2 py-0.5 rounded border border-neutral-700 hover:bg-neutral-800"
                            title="Refresh participants"
                          >
                            ↻
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{game.duration_minutes} min</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={classNames(
                          "px-2 py-1 rounded-full text-xs font-medium border",
                          getSkillLevelColor(game.skill_level)
                        )}>
                          {game.skill_level}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {game.cost > 0 ? `$${game.cost}` : "Free"}
                        </span>
                      </div>

                      {game.notes && (
                        <div className="pt-2 border-t border-neutral-800">
                          <p className="text-sm text-neutral-400">{game.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-auto">
                      {user && user.user_id === game.host_id ? (
                        <div className="mt-4">
                          <button
                            onClick={() => setEditingGame(game)}
                            className="w-full py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-medium"
                          >
                            Edit
                          </button>
                        </div>

                      ) : (

                        game.status === "Full" ? (
                          <>
                            {/* 🟨 Yellow queue info box */}
                            <div className="w-full mt-4 p-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-yellow-300">Game is full — Queue</span>
                                <button
                                  onClick={() => fetchWaitlist(game.game_id)}
                                  className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition"
                                >
                                  Refresh
                                </button>
                              </div>

                              {waitlistLoading[game.game_id] ? (
                                <p className="text-xs text-neutral-300">Loading queue…</p>
                              ) : waitlistError[game.game_id] ? (
                                <p className="text-xs text-red-400">{waitlistError[game.game_id]}</p>
                              ) : (waitlists[game.game_id]?.length ?? 0) === 0 ? (
                                <p className="text-xs text-neutral-300">No one waiting yet.</p>
                              ) : (
                                <ol className="list-decimal pl-5 space-y-1 text-sm text-neutral-200">
                                  {waitlists[game.game_id].map((u, idx) => (
                                    <li key={String(u.user_id ?? u.id)}>
                                      {(u.name ?? u.full_name ?? `User ${u.user_id ?? u.id}`)} — position{" "}
                                      <b>{idx + 1}</b>
                                    </li>
                                  ))}
                                </ol>
                              )}

                              {/* 👤 Show user’s position if in queue */}
                              {user && (() => {
                                const list = waitlists[game.game_id] || [];
                                const meIdx = list.findIndex(i => String(i.user_id ?? i.id) === String(user.user_id));
                                if (meIdx >= 0) {
                                  return (
                                    <p className="mt-2 text-xs text-white-300">
                                      <b> You are currently in position{meIdx + 1}</b>.
                                    </p>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            {/* 💜 Join/Leave button below box */}
                            <div className="mt-4">
                              {user ? (() => {
                                const list = waitlists[game.game_id] || [];
                                const meIdx = list.findIndex(i => String(i.user_id ?? i.id) === String(user.user_id));
                                const inQueue = meIdx >= 0;
                                return inQueue ? (
                                  <button
                                    onClick={() => leaveWaitlist(game.game_id, user.user_id)}
                                    className="w-full py-2 text-white rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 font-medium transition"
                                  >
                                    Leave queue
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => joinWaitlist(game.game_id, user.user_id)}
                                    className="w-full py-2 text-white rounded-lg bg-violet-500 hover:bg-violet-400 font-medium transition"
                                  >
                                    Join queue
                                  </button>
                                );
                              })() : (
                                <span className="text-xs text-neutral-400">Login to join the queue</span>
                              )}
                            </div>
                          </>
                        )

                          : (
                            iAmInGame[game.game_id] ? (
                              <button
                                onClick={() => leaveGame(game.game_id)}
                                disabled={leavingGameId === game.game_id}
                                className={classNames(
                                  "w-full mt-4 py-2 text-white rounded-lg transition-colors font-medium",
                                  leavingGameId === game.game_id
                                    ? "bg-neutral-800 cursor-not-allowed"
                                    : "bg-red-500 hover:bg-red-400"
                                )}
                              >
                                {leavingGameId === game.game_id ? "Leaving..." : "Leave Game"}
                              </button>
                            ) : (
                              <button
                                onClick={() => joinGame(game.game_id)}
                                disabled={joiningGameId === game.game_id}
                                className={classNames(
                                  "w-full mt-4 py-2 text-white rounded-lg transition-colors font-medium",
                                  joiningGameId === game.game_id
                                    ? "bg-neutral-800 cursor-not-allowed"
                                    : "bg-violet-500 hover:bg-violet-400"
                                )}
                              >
                                {joiningGameId === game.game_id ? "Joining..." : "Join Game"}
                              </button>
                            )
                          )
                      )}
                    </div>


                  </div>
                </>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* ✏️ Edit Game Modal */}
      {editingGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8 max-w-3xl w-full mx-4 my-10">
            {/* ❌ Close button */}
            <button
              type="button"
              onClick={() => setEditingGame(null)}
              className="absolute top-6 right-4 text-neutral-400 hover:text-white hover:scale-110 transition-transform text-2xl leading-none"
              aria-label="Close"
            >
              ×
            </button>

            {/* Title */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">Edit Game</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Update game details and settings below.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateGame} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Sport */}
                <div className="flex flex-col">
                  <label className="text-sm text-neutral-300 mb-1.5">Sport</label>
                  <div className="relative">
                    <select
                      value={editingGame.sport_id}
                      onChange={(e) =>
                        setEditingGame({
                          ...editingGame,
                          sport_id: parseInt(e.target.value),
                        })
                      }
                      className="appearance-none w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-8"
                    >
                      {sports.map((sport) => (
                        <option key={sport.sport_id} value={sport.sport_id}>
                          {sport.name}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                      ▼
                    </span>
                  </div>
                </div>

                {/* Start Time */}
                <div className="flex flex-col">
                  <label className="text-sm text-neutral-300 mb-1.5">Start Time</label>
                  <input
                    type="datetime-local"
                    value={editingGame.start_time?.slice(0, 16) || ""}
                    onChange={(e) =>
                      setEditingGame({ ...editingGame, start_time: e.target.value })
                    }
                    className="w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                {/* Duration */}
                <div className="flex flex-col">
                  <label className="text-sm text-neutral-300 mb-1.5">Duration (minutes)</label>
                  <input
                    type="number"
                    min="15"
                    value={editingGame.duration_minutes}
                    onChange={(e) =>
                      setEditingGame({
                        ...editingGame,
                        duration_minutes: parseInt(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                {/* Location */}
                <div className="flex flex-col">
                  <label className="text-sm text-neutral-300 mb-1.5">Location</label>
                  <input
                    type="text"
                    value={editingGame.location}
                    onChange={(e) =>
                      setEditingGame({ ...editingGame, location: e.target.value })
                    }
                    placeholder="Enter location"
                    className="w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                {/* Skill Level */}
                <div className="flex flex-col">
                  <label className="text-sm text-neutral-300 mb-1.5">Skill Level</label>
                  <div className="relative">
                    <select
                      value={editingGame.skill_level}
                      onChange={(e) =>
                        setEditingGame({ ...editingGame, skill_level: e.target.value })
                      }
                      className="appearance-none w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-8"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                      ▼
                    </span>
                  </div>
                </div>

                {/* Max Players */}
                <div className="flex flex-col">
                  <label className="text-sm text-neutral-300 mb-1.5">Max Players</label>
                  <input
                    type="number"
                    min="2"
                    value={editingGame.max_players}
                    onChange={(e) =>
                      setEditingGame({
                        ...editingGame,
                        max_players: parseInt(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                {/* Cost */}
                <div className="flex flex-col">
                  <label className="text-sm text-neutral-300 mb-1.5">Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingGame.cost}
                    onChange={(e) =>
                      setEditingGame({
                        ...editingGame,
                        cost: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                {/* Status */}
                <div className="flex flex-col">
                  <label className="text-sm text-neutral-300 mb-1.5">Status</label>
                  <div className="relative">
                    <select
                      value={editingGame.status}
                      onChange={(e) =>
                        setEditingGame({ ...editingGame, status: e.target.value })
                      }
                      className="appearance-none w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent pr-8"
                    >
                      <option value="Open">Open</option>
                      <option value="Full">Full</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                      ▼
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm text-neutral-300 mb-1.5">Notes</label>
                <textarea
                  value={editingGame.notes || ""}
                  onChange={(e) =>
                    setEditingGame({ ...editingGame, notes: e.target.value })
                  }
                  placeholder="Add any additional notes..."
                  className="w-full rounded-lg bg-neutral-950/80 border border-neutral-700 px-3 py-2 text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y min-h-[80px] max-h-[160px]"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-medium"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGame(null)}
                  className="flex-1 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium"
                >
                  Cancel
                </button>
              </div>

              {/* Delete */}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this game?')) {
                    handleDeleteGame(editingGame.game_id);
                    setEditingGame(null);
                  }
                }}
                className="w-full -mt-10 py-2 !bg-red-500 hover:!bg-red-600 text-white rounded-lg font-medium transition-colors"
              >
                Delete Game
              </button>
            </form>
          </div>
        </div>
      )}


      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-4 -translate-x-1/2 rounded-full bg-neutral-900 border border-neutral-700 px-4 py-2 text-sm text-neutral-100 shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
