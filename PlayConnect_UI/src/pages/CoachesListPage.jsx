import React, { useState, useEffect } from "react";
import { Search, Star, MapPin, Award, ChevronRight } from "lucide-react";
import VerificationRequestModal from "../components/VerificationRequestModal";

export default function CoachesListPage() {
  const [search, setSearch] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);


  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("role");
    window.location.href = "/login";
  };


  const API_BASE = "http://127.0.0.1:8000";

  // Fetch coaches from backend
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/coaches`);
        const data = await res.json();
        setCoaches(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching coaches:", err);
        setError("Failed to load coaches");
        setLoading(false);
      }
    };
    fetchCoaches();
  }, []);

  const getInitials = (firstName, lastName) => {
    const first = firstName || "";
    const last = lastName || "";
    if (!first && !last) return "?";
    if (!last) return first[0]?.toUpperCase() || "?";
    return (first[0] + last[0]).toUpperCase();
  };

  const filteredCoaches = coaches.filter(coach => {
    const fullName = `${coach.first_name} ${coach.last_name}`.toLowerCase();
    const searchLower = search.toLowerCase();
    return fullName.includes(searchLower) || 
           (coach.location && coach.location.toLowerCase().includes(searchLower)) ||
           (coach.certifications && coach.certifications.toLowerCase().includes(searchLower));
  });

  const handleViewProfile = (coachId) => {
    window.location.href = `/coach/${coachId}`;
  };

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
        <a
          href="/"
          className="flex items-center gap-2 text-2xl font-bold hover:opacity-90 transition-opacity"
        >
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
            PlayConnect
          </span>
          <span>🏀🎾</span>
        </a>

        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-white hover:text-neutral-100 text-sm transition"
          >
            ← Back to Home
          </a>
          <a
            href="/dashboard"
            className="text-white hover:text-neutral-100 text-sm transition"
          >
            Dashboard
          </a>

          {/* ✅ Request Verification Button */}
          <button
            onClick={() => setShowVerifyModal(true)}
            className="bg-gradient-to-r from-indigo-500/90 to-fuchsia-500/90 hover:from-indigo-600 hover:to-fuchsia-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2 shadow-lg shadow-fuchsia-500/20 border border-fuchsia-500/20"
          >
            <CheckCircle size={16} />
            Request Verification
          </button>

          <button
            onClick={handleLogout}
            className="bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-lg font-semibold text-sm transition text-white"
          >
            Logout
          </button>
        </div>
      </div>

      {/* === Header Section === */}
      <div className="text-center mt-6 mb-10 relative z-10">
        <h2 className="text-4xl font-bold text-fuchsia-300 tracking-wide mb-2">
          Find Your Coach
        </h2>
        <p className="text-neutral-400 text-sm">
          Connect with certified coaches to improve your game
        </p>
      </div>

      {/* === Filters Section === */}
      <div className="max-w-6xl mx-auto px-10 pb-8 relative z-10">
        {/* Search Bar */}
        <div className="mb-6 flex items-center gap-3 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 hover:border-neutral-700 transition max-w-md mx-auto">
          <Search size={18} className="text-neutral-500" />
          <input
            type="text"
            placeholder="Search by name, location, or certification..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent outline-none flex-1 text-neutral-100 placeholder-neutral-600 text-sm"
          />
        </div>
      </div>

      {/* === Coaches Grid === */}
      <div className="max-w-6xl mx-auto px-10 pb-20 relative z-10">
        <div className="mb-6 text-neutral-400 text-sm">
          Showing {filteredCoaches.length} {filteredCoaches.length === 1 ? 'coach' : 'coaches'}
        </div>

        {loading ? (
          <div className="text-center py-12 text-neutral-400">
            Loading coaches...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-400">
            {error}
          </div>
        ) : filteredCoaches.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCoaches.map((coach) => (
              <div
                key={coach.coach_id}
                className="group bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg hover:shadow-fuchsia-900/50 hover:border-fuchsia-800/50 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                onClick={() => handleViewProfile(coach.coach_id)}
              >
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-indigo-900/40 to-fuchsia-900/40 p-6 pb-16 relative">
                  <div className="absolute top-6 right-6">
                    {coach.isverified && (
                      <div className="bg-green-500 rounded-full p-1.5">
                        <Award size={14} className="text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Avatar - positioned to overlap */}
                  <div className="absolute -bottom-12 left-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-2xl border-4 border-neutral-900">
                      {getInitials(coach.first_name, coach.last_name)}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 pt-16">
                  <h3 className="text-xl font-bold text-indigo-300 mb-1">
                    {coach.first_name} {coach.last_name}
                  </h3>
                  <p className="text-sm text-fuchsia-400 mb-4">{coach.experience_yrs} years experience</p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-neutral-400 mb-4 pb-4 border-b border-neutral-800">
                    {coach.certifications && (
                      <div className="flex items-center gap-1">
                        <Award size={14} className="text-indigo-400" />
                        <span className="truncate">{coach.certifications}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-500">Hourly Rate</p>
                      <p className="text-lg font-bold text-fuchsia-300">${coach.hourly_rate}</p>
                    </div>
                    <button className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-600 hover:to-fuchsia-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1 group-hover:shadow-lg group-hover:shadow-fuchsia-500/20">
                      View Profile
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-xl">
            <p className="text-neutral-400">No coaches found matching your criteria</p>
            <button
              onClick={() => setSearch("")}
              className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm transition"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
      {/* ✅ Verification Modal */}
        {showVerifyModal && (
          <VerificationRequestModal
            isOpen={showVerifyModal}
            onClose={() => setShowVerifyModal(false)}
  />
)}

    </div>
  );
}
