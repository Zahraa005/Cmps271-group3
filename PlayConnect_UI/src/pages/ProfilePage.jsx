import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Award, ChevronDown, Flame, Target } from "lucide-react";
import MatchHistoryPanel from "../components/MatchHistoryPanel";
import { useAuth } from "../contexts/AuthContext";
import API_BASE_URL from "../Api/config";

const xpRequiredForLevel = (level = 0) => Math.max(100, (level + 1) * 100);

const aggregateUserStats = (entries = []) => {
  if (!entries.length) {
    return { totals: null };
  }

  const totals = entries.reduce(
    (acc, stat) => {
      acc.games_played += stat.games_played ?? 0;
      acc.games_hosted += stat.games_hosted ?? 0;
      acc.xp += stat.xp ?? 0;
      acc.level = Math.max(acc.level, stat.level ?? 0);
      return acc;
    },
    { games_played: 0, games_hosted: 0, xp: 0, level: 0 }
  );
  return { totals };
};

export default function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileData, setEditProfileData] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [sports, setSports] = useState([]);
  const [rawStats, setRawStats] = useState([]);
  const [badges, setBadges] = useState([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showXpMilestones, setShowXpMilestones] = useState(false);
  const [showBadgeCriteria, setShowBadgeCriteria] = useState(false);

  const stats = aggregateUserStats(rawStats);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (isAuthenticated === false) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!user?.user_id) return;
    fetchSports();
    fetchProfile();
    fetchStats();
    fetchBadges();
  }, [user?.user_id]);

  const fetchSports = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sports`);
      if (!res.ok) throw new Error("Failed to load sports");
      const data = await res.json();
      setSports(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Sports load error:", error);
    }
  };

  const fetchProfile = async () => {
    if (!user?.user_id) return;
    setProfileLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/profile/${user.user_id}`);
      if (!response.ok) throw new Error("Failed to load profile");
      const profile = await response.json();
      setProfileData(profile);
    } catch (error) {
      console.error("Profile load error:", error);
      setToast("Failed to load profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user?.user_id) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user_stats`);
      if (!res.ok) throw new Error("Failed to load stats");
      const data = await res.json();
      const mine = Array.isArray(data)
        ? data.filter((stat) => String(stat.user_id) === String(user.user_id))
        : [];
      setRawStats(mine);
    } catch (error) {
      console.error("Stats load error:", error);
      setRawStats([]);
    } finally {
      // no-op
    }
  };

  const fetchBadges = async () => {
    if (!user?.user_id) return;
    setBadgesLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user_badges?user_id=${encodeURIComponent(user.user_id)}`
      );
      if (!res.ok) throw new Error("Failed to load badges");
      const data = await res.json();
      setBadges(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Badges load error:", error);
      setBadges([]);
    } finally {
      setBadgesLoading(false);
    }
  };

  const handleEditProfile = () => {
    if (!profileData) return;
    setEditProfileData({
      first_name: profileData.first_name || "",
      last_name: profileData.last_name || "",
      age: profileData.age || "",
      bio: profileData.bio || "",
      favorite_sport: profileData.favorite_sport || "",
      role: profileData.role || "player",
    });
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
    setIsEditingProfile(true);
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setEditProfileData({});
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
  };

  const handleEditInputChange = (field, value) => {
    setEditProfileData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProfilePictureChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setProfilePictureFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setProfilePicturePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const removeProfilePicture = () => {
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
    setEditProfileData((prev) => ({ ...prev, avatar_url: "" }));
  };

  const handleSaveProfile = async () => {
    if (!user?.user_id) return;
    setProfileSaving(true);
    try {
      const payload = { ...editProfileData };
      if (profilePictureFile) {
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(profilePictureFile);
        });
        payload.avatar_url = base64;
      }

      const response = await fetch(`${API_BASE_URL}/profile/${user.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to update profile");
      }

      const updated = await response.json();
      setProfileData(updated);
      setIsEditingProfile(false);
      setProfilePictureFile(null);
      setProfilePicturePreview(null);
      await Promise.all([fetchStats(), fetchBadges()]);
      setToast("Profile updated!");
    } catch (error) {
      console.error("Profile update error:", error);
      setToast(error.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  if (!user?.user_id) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center">
        Loading your profile...
      </div>
    );
  }

  const level = stats.totals?.level ?? 0;
  const xp = stats.totals?.xp ?? 0;
  const xpGoal = xpRequiredForLevel(level);
  const xpToNext = Math.max(xpGoal - xp, 0);
  const xpProgress = xpGoal ? Math.min((xp / xpGoal) * 100, 100) : 0;
  const nextReward =
    xpToNext === 0
      ? "Legend tier reward pending"
      : `Level ${level + 1} badge unlock`;

  const summaryCards = [
    {
      label: "Games Played",
      value: stats.totals?.games_played ?? 0,
      accent: "from-indigo-500 to-fuchsia-500",
    },
    {
      label: "Games Hosted",
      value: stats.totals?.games_hosted ?? 0,
      accent: "from-emerald-500 to-teal-500",
    },
    {
      label: "XP",
      value: xp,
      accent: "from-sky-500 to-blue-500",
    },
    {
      label: "Current Level",
      value: level,
      accent: "from-amber-500 to-orange-500",
    },
  ];

  const xpMilestones = [
    {
      icon: "🌱",
      name: "Rookie Boost",
      requirement: "Reach 100 XP",
      description: "Unlocks quick-join coaching tips.",
    },
    {
      icon: "🚀",
      name: "Rising Star",
      requirement: "Reach 500 XP",
      description: "Featured on the dashboard spotlight reel.",
    },
    {
      icon: "🧭",
      name: "Playmaker",
      requirement: "Reach 1,000 XP",
      description: "Gain access to advanced event filters.",
    },
    {
      icon: "👑",
      name: "Legend Tier",
      requirement: "Reach 2,000 XP",
      description: "Unlock exclusive rewards and badges.",
    },
  ];

  const badgeCriteria = [
    {
      icon: "🏃",
      name: "First Match",
      criteria: "Play 1 game",
      description: "Welcome badge for new players.",
    },
    {
      icon: "⚡",
      name: "Active Player",
      criteria: "Play 10 games",
      description: "Encourages consistent participation.",
    },
    {
      icon: "🧠",
      name: "Strategist",
      criteria: "Host 5 games",
      description: "For community organizers.",
    },
    {
      icon: "🤝",
      name: "Socializer",
      criteria: "Add 10 friends",
      description: "Builds your PlayConnect network.",
    },
    {
      icon: "💪",
      name: "Coach Verified",
      criteria: "Get verified",
      description: "Earned by verified coaches.",
    },
    {
      icon: "🔥",
      name: "Weekly Streak",
      criteria: "Log in 7 consecutive days",
      description: "Rewards consistency.",
    },
    {
      icon: "🌟",
      name: "Top Player",
      criteria: "Rank in top 10% by XP",
      description: "Seasonal badge for elite players.",
    },
  ];

  const hasPlayed = (stats.totals?.games_played ?? 0) > 0;
  const hasHosted = (stats.totals?.games_hosted ?? 0) > 0;
  const hasSocializerBadge = badges.some((b) => b.badge_name === "Socializer");

  const xpObjectives = [
    {
      id: "play",
      icon: "🎮",
      title: "Play a Game",
      reward: "+25 XP",
      description: "Join any scheduled pickup or training session.",
      completed: hasPlayed,
    },
    {
      id: "host",
      icon: "🏟️",
      title: "Host a Game",
      reward: "+40 XP",
      description: "Create a new session and bring players together.",
      completed: hasHosted,
    },
    {
      id: "friend",
      icon: "🤝",
      title: "Make a Friend",
      reward: "+15 XP",
      description: "Grow your network by accepting a friend request.",
      completed: hasSocializerBadge,
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white relative overflow-hidden">
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
            "radial-gradient(600px 300px at 20% 0%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(600px 300px at 80% 100%, rgba(244,114,182,0.12), transparent 60%)",
        }}
      />

      <header className="max-w-6xl mx-auto px-6 pt-8 flex flex-wrap items-center justify-between gap-4 relative z-10">
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 text-neutral-300 hover:text-white transition"
        >
          <ArrowLeft size={18} /> Back to Dashboard
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-3 py-1.5 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-800 transition"
          >
            Dashboard
          </button>
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pb-20 space-y-8">
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 mt-6 shadow-2xl">
          {profileLoading ? (
            <div className="text-neutral-400">Loading profile...</div>
          ) : profileData ? (
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex flex-col items-center text-center md:w-56">
                <div className="relative">
                  {profileData.avatar_url ? (
                    <img
                      src={profileData.avatar_url}
                      alt="Avatar"
                      className="w-32 h-32 rounded-full object-cover border-4 border-neutral-800"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-4xl font-bold border-4 border-neutral-800">
                      {profileData.first_name
                        ? profileData.first_name.charAt(0).toUpperCase()
                        : "?"}
                    </div>
                  )}
                  <span className="absolute -bottom-2 -right-2 bg-neutral-900 border border-violet-500 rounded-full px-3 py-1 text-xs font-semibold">
                    Level {level}
                  </span>
                </div>
                <p className="text-sm text-neutral-400 mt-4">
                  Joined{" "}
                  {profileData.created_at
                    ? new Date(profileData.created_at).toLocaleDateString()
                    : "PlayConnect"}
                </p>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-3xl font-semibold">
                    {profileData.first_name} {profileData.last_name}
                  </h1>
                  <p className="text-neutral-400">
                    {profileData.bio || "Share a bit about yourself"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/40 text-sm text-violet-200">
                    {profileData.role || "player"}
                  </span>
                  {profileData.favorite_sport && (
                    <span className="px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sm text-sky-200">
                      Favorite: {profileData.favorite_sport}
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-200">
                    XP {xp}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleEditProfile}
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-800 transition"
                  >
                    View Games
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-neutral-400">
              We couldn’t load your profile.{" "}
              <button
                className="underline text-white"
                onClick={fetchProfile}
              >
                Retry
              </button>
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5 shadow-lg"
            >
              <p className="text-sm text-neutral-400">{card.label}</p>
              <p className="text-3xl font-semibold mt-2">{card.value}</p>
              <div
                className={`mt-4 h-1 rounded-full bg-gradient-to-r ${card.accent}`}
              />
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-xl font-semibold">XP Objectives</h2>
              <p className="text-sm text-neutral-400">
                Complete these actions to climb levels faster.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {xpObjectives.map((objective) => (
              <div
                key={objective.id}
                className={`rounded-2xl border bg-neutral-950/40 p-4 flex flex-col gap-2 transition ${
                  objective.completed
                    ? "border-neutral-700 opacity-60"
                    : "border-neutral-800"
                }`}
              >
                <div className="text-2xl">{objective.icon}</div>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{objective.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full">
                      {objective.reward}
                    </span>
                    {objective.completed && (
                      <span className="text-emerald-400 text-xs font-semibold">✓</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-neutral-400">
                  {objective.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Profile Settings</h2>
                  <p className="text-sm text-neutral-400">
                    Update your personal information
                  </p>
                </div>
                {isEditingProfile && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition disabled:opacity-50"
                    >
                      {profileSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1.5 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-800 transition"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {profileLoading ? (
                <p className="text-neutral-400">Loading profile...</p>
              ) : profileData ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="w-24 h-24 rounded-full bg-neutral-800 flex items-center justify-center text-2xl font-semibold overflow-hidden border border-neutral-700">
                      {profilePicturePreview ? (
                        <img
                          src={profilePicturePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : profileData.avatar_url ? (
                        <img
                          src={profileData.avatar_url}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        (profileData.first_name || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    {isEditingProfile && (
                      <div className="flex flex-wrap gap-3">
                        <label className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium cursor-pointer transition">
                          Upload Photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePictureChange}
                            className="hidden"
                          />
                        </label>
                        {profilePictureFile && (
                          <button
                            onClick={removeProfilePicture}
                            className="px-4 py-2 rounded-lg border border-neutral-700 text-sm text-neutral-200 hover:bg-neutral-800 transition"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {["first_name", "last_name"].map((field) => (
                      <div key={field}>
                        <label className="text-sm text-neutral-400 mb-1 block capitalize">
                          {field.replace("_", " ")}
                        </label>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={editProfileData[field] || ""}
                            onChange={(e) =>
                              handleEditInputChange(field, e.target.value)
                            }
                            className="w-full rounded-lg bg-neutral-950/60 border border-neutral-800 px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                        ) : (
                          <p className="px-3 py-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
                            {profileData[field] || "Not set"}
                          </p>
                        )}
                      </div>
                    ))}
                    <div>
                      <label className="text-sm text-neutral-400 mb-1 block">
                        Age
                      </label>
                      {isEditingProfile ? (
                        <input
                          type="number"
                          min="1"
                          value={editProfileData.age || ""}
                          onChange={(e) =>
                            handleEditInputChange(
                              "age",
                              e.target.value ? Number(e.target.value) : ""
                            )
                          }
                          className="w-full rounded-lg bg-neutral-950/60 border border-neutral-800 px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                      ) : (
                        <p className="px-3 py-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
                          {profileData.age || "Not set"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-neutral-400 mb-1 block">
                        Role
                      </label>
                      {isEditingProfile ? (
                        <select
                          value={editProfileData.role || "player"}
                          onChange={(e) =>
                            handleEditInputChange("role", e.target.value)
                          }
                          className="w-full rounded-lg bg-neutral-950/60 border border-neutral-800 px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                          <option value="player">Player</option>
                          <option value="coach">Coach</option>
                          <option value="organizer">Organizer</option>
                        </select>
                      ) : (
                        <p className="px-3 py-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
                          {profileData.role || "Player"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400 mb-1 block">
                      Favorite Sport
                    </label>
                    {isEditingProfile ? (
                      <select
                        value={editProfileData.favorite_sport || ""}
                        onChange={(e) =>
                          handleEditInputChange(
                            "favorite_sport",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg bg-neutral-950/60 border border-neutral-800 px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="">Select a sport</option>
                        {sports.map((sport) => (
                          <option key={sport.sport_id} value={sport.name}>
                            {sport.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="px-3 py-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
                        {profileData.favorite_sport || "Not set"}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-neutral-400 mb-1 block">
                      Bio
                    </label>
                    {isEditingProfile ? (
                      <textarea
                        value={editProfileData.bio || ""}
                        onChange={(e) =>
                          handleEditInputChange("bio", e.target.value)
                        }
                        rows={3}
                        className="w-full rounded-lg bg-neutral-950/60 border border-neutral-800 px-3 py-2 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="px-3 py-2 rounded-lg bg-neutral-950/40 border border-neutral-800">
                        {profileData.bio || "No bio yet"}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-neutral-400">No profile data found.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Flame size={22} className="text-amber-400" />
                <div>
                  <h2 className="text-xl font-semibold">Level Progress</h2>
                  <p className="text-sm text-neutral-400">
                    Keep the streak going!
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm text-neutral-400 mb-1">
                    <span>Level {level}</span>
                    <span>{xp}/{xpGoal} XP</span>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                      style={{ width: `${xpProgress}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 flex items-center gap-3">
                  <Target className="text-sky-300" size={20} />
                  <div>
                    <p className="text-sm text-neutral-400">Next Reward</p>
                    <p className="font-semibold">{nextReward}</p>
                    <p className="text-xs text-neutral-500">
                      {xpToNext > 0
                        ? `${xpToNext} XP to go`
                        : "You’re ready for the next tier!"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowXpMilestones((prev) => !prev)}
                  className="w-full flex items-center justify-between rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 transition"
                >
                  <span>Milestone guide</span>
                  <ChevronDown
                    size={18}
                    className={`transition-transform ${
                      showXpMilestones ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showXpMilestones && (
                  <div className="space-y-3 border border-neutral-800 rounded-2xl bg-neutral-950/40 p-4">
                    {xpMilestones.map((milestone) => (
                      <div
                        key={milestone.name}
                        className="flex gap-3 border-b border-neutral-800/60 pb-3 last:border-b-0 last:pb-0"
                      >
                        <div className="text-2xl">{milestone.icon}</div>
                        <div>
                          <p className="font-semibold">{milestone.name}</p>
                          <p className="text-sm text-neutral-300">
                            {milestone.requirement}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {milestone.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Award size={22} className="text-emerald-300" />
                <div>
                  <h2 className="text-xl font-semibold">Badges</h2>
                  <p className="text-sm text-neutral-400">
                    Showcase your milestones
                  </p>
                </div>
              </div>
              {badgesLoading ? (
                <p className="text-neutral-400">Loading badges...</p>
              ) : badges.length === 0 ? (
                <p className="text-neutral-500">
                  No badges yet. Complete games and events to earn rewards.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="px-4 py-2 rounded-full border border-emerald-500/40 text-sm text-emerald-200 bg-emerald-500/10"
                    >
                      {badge.badge_name}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setShowBadgeCriteria((prev) => !prev)}
                className="mt-4 w-full flex items-center justify-between rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 transition"
              >
                <span>How to earn badges</span>
                <ChevronDown
                  size={18}
                  className={`transition-transform ${
                    showBadgeCriteria ? "rotate-180" : ""
                  }`}
                />
              </button>
              {showBadgeCriteria && (
                <div className="mt-3 space-y-3 border border-neutral-800 rounded-2xl bg-neutral-950/40 p-4">
                  {badgeCriteria.map((badge) => (
                    <div
                      key={badge.name}
                      className="flex gap-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 px-4 py-3"
                    >
                      <div className="text-2xl">{badge.icon}</div>
                      <div>
                        <p className="font-semibold">{badge.name}</p>
                        <p className="text-sm text-neutral-300">
                          {badge.criteria}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {badge.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target size={22} className="text-violet-300" />
            <div>
              <h2 className="text-xl font-semibold">Match History</h2>
              <p className="text-sm text-neutral-400">
                Review recent games and report issues
              </p>
            </div>
          </div>
          <MatchHistoryPanel userId={user.user_id} />
        </section>
      </main>

      {toast && (
        <div className="fixed left-1/2 top-4 -translate-x-1/2 rounded-full bg-neutral-900 border border-neutral-700 px-4 py-2 text-sm text-neutral-100 shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
