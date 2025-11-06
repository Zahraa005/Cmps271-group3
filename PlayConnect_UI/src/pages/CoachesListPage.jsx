import React, { useState, useEffect } from "react";
import { Search, Star, MapPin, Award, ChevronRight, CheckCircle, Plus } from "lucide-react";
import VerificationRequestModal from "../components/VerificationRequestModal";

export default function CoachesListPage() {
  const [search, setSearch] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isUserCoach, setIsUserCoach] = useState(false);
  const [user_id, setUser_id] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);


  const handleLogout = () => {
    try {
      localStorage.clear(); // Clear all stored user data, tokens, and roles
      console.log("[Logout] Cleared all local storage. Redirecting to home...");
      window.location.replace("/"); // Redirect cleanly to the home page
    } catch (err) {
      console.error("[Logout] Error during logout:", err);
    }
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

  // Check if user is a coach
  useEffect(() => {
    const checkUserCoach = () => {
      const userId = Number(localStorage.getItem("user_id"));
      const userData = localStorage.getItem("userData");
      
      if (userId && userData) {
        setUser_id(userId);
        try {
          const parsedUser = JSON.parse(userData);
          // Show button if user has "coach" role
          setIsUserCoach(parsedUser.role === "coach");
        } catch (e) {
          console.error("Error parsing userData:", e);
        }
      }
    };
    checkUserCoach();
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

  const refreshCoaches = async () => {
    try {
      const res = await fetch(`${API_BASE}/coaches`);
      const data = await res.json();
      setCoaches(data);
    } catch (e) {
      // ignore silently
    }
  };

  const confirmDelete = (coachId) => {
    setConfirmingDeleteId(coachId);
  };

  const handleDelete = async () => {
    if (!confirmingDeleteId) return;
    try {
      await fetch(`${API_BASE}/coaches/${confirmingDeleteId}`, { method: "DELETE" });
      setConfirmingDeleteId(null);
      refreshCoaches();
    } catch (e) {
      setConfirmingDeleteId(null);
    }
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

          {/* ✅ Create Listing Button - only show if user is a coach */}
          {isUserCoach && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-green-500/90 to-emerald-500/90 hover:from-green-600 hover:to-emerald-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition flex items-center gap-2 shadow-lg shadow-green-500/20 border border-green-500/20"
            >
              <Plus size={16} />
              Create Listing
            </button>
          )}

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
                className="group bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-lg hover:shadow-fuchsia-900/50 hover:border-fuchsia-800/50 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-indigo-900/40 to-fuchsia-900/40 p-6 pb-16 relative">
                  <div className="absolute top-6 right-6 flex items-center gap-2">
                    {user_id === coach.coach_id && (
                      <>
                        <button
                          onClick={() => setEditTarget(coach)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => confirmDelete(coach.coach_id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewProfile(coach.coach_id)}
                        className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-600 hover:to-fuchsia-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1 group-hover:shadow-lg group-hover:shadow-fuchsia-500/20"
                      >
                        View Profile
                        <ChevronRight size={16} />
                      </button>
                    </div>
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

      {/* ✅ Create Listing Modal */}
      {showCreateModal && (
        <CreateListingModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          user_id={user_id}
          onSuccess={() => {
            setShowCreateModal(false);
            // Refresh coaches list
            refreshCoaches();
          }}
        />
      )}

      {/* ✅ Edit Listing Modal */}
      {editTarget && (
        <EditListingModal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          coach={editTarget}
          onSuccess={() => {
            setEditTarget(null);
            refreshCoaches();
          }}
        />
      )}

      {/* ✅ Delete Confirmation */}
      {confirmingDeleteId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-[90%] max-w-sm text-white shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Delete Listing?</h3>
            <p className="text-sm text-neutral-400 mb-6">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmingDeleteId(null)} className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Create Listing Modal Component
function CreateListingModal({ isOpen, onClose, user_id, onSuccess }) {
  const [experienceYrs, setExperienceYrs] = useState("");
  const [certifications, setCertifications] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const API_BASE = "http://127.0.0.1:8000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      setError("");

      const coachData = {
        user_id: user_id,
        experience_yrs: experienceYrs ? parseInt(experienceYrs) : null,
        certifications: certifications || null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        isverified: false
      };

      const res = await fetch(`${API_BASE}/coaches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(coachData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to create coach listing");
      }

      setSuccess(true);
      setTimeout(() => {
        setSubmitting(false);
        setSuccess(false);
        setExperienceYrs("");
        setCertifications("");
        setHourlyRate("");
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error creating coach listing.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 w-[90%] max-w-md text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-neutral-400 hover:text-white text-xl leading-none"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold text-green-300 mb-6">
          Create Coach Listing
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Experience */}
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">
              Years of Experience
            </label>
            <input
              type="number"
              min="0"
              value={experienceYrs}
              onChange={(e) => setExperienceYrs(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-green-500 outline-none transition"
              placeholder="e.g. 5"
            />
          </div>

          {/* Certifications */}
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">
              Certifications
            </label>
            <input
              type="text"
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-green-500 outline-none transition"
              placeholder="e.g. USPTA Level 1, NCCA Certified"
            />
          </div>

          {/* Hourly Rate */}
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">
              Hourly Rate ($)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-green-500 outline-none transition"
              placeholder="e.g. 50.00"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-500/20 border border-green-500 rounded-lg px-4 py-3 text-sm text-green-300">
              Coach listing created successfully!
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || success}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-neutral-700 disabled:to-neutral-700 text-white py-3 rounded-lg font-semibold transition"
          >
            {submitting ? "Creating..." : success ? "Success!" : "Create Listing"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Edit Listing Modal Component
function EditListingModal({ isOpen, onClose, coach, onSuccess }) {
  const [experienceYrs, setExperienceYrs] = useState(coach?.experience_yrs ?? "");
  const [certifications, setCertifications] = useState(coach?.certifications ?? "");
  const [hourlyRate, setHourlyRate] = useState(coach?.hourly_rate ?? "");
  const [firstName, setFirstName] = useState(coach?.first_name ?? "");
  const [lastName, setLastName] = useState(coach?.last_name ?? "");
  const [favoriteSport, setFavoriteSport] = useState(coach?.favorite_sport ?? "");
  const [avatarUrl, setAvatarUrl] = useState(coach?.avatar_url ?? "");
  const [bio, setBio] = useState(coach?.bio ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setExperienceYrs(coach?.experience_yrs ?? "");
    setCertifications(coach?.certifications ?? "");
    setHourlyRate(coach?.hourly_rate ?? "");
    setFirstName(coach?.first_name ?? "");
    setLastName(coach?.last_name ?? "");
    setFavoriteSport(coach?.favorite_sport ?? "");
    setAvatarUrl(coach?.avatar_url ?? "");
    setBio(coach?.bio ?? "");
  }, [coach]);

  if (!isOpen) return null;

  const API_BASE = "http://127.0.0.1:8000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError("");

      const body = {
        experience_yrs: experienceYrs !== "" ? parseInt(experienceYrs) : undefined,
        certifications: certifications !== "" ? certifications : undefined,
        hourly_rate: hourlyRate !== "" ? parseFloat(hourlyRate) : undefined,
        first_name: firstName !== "" ? firstName : undefined,
        last_name: lastName !== "" ? lastName : undefined,
        favorite_sport: favoriteSport !== "" ? favoriteSport : undefined,
        avatar_url: avatarUrl !== "" ? avatarUrl : undefined,
        bio: bio !== "" ? bio : undefined,
      };

      const res = await fetch(`${API_BASE}/coaches/${coach.coach_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to update coach listing");
      }

      setSuccess(true);
      setTimeout(() => {
        setSubmitting(false);
        setSuccess(false);
        onSuccess();
      }, 1000);
    } catch (e) {
      setError(e.message || "Error updating listing");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 w-[90%] max-w-md text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 text-neutral-400 hover:text-white text-xl leading-none">×</button>
        <h2 className="text-2xl font-bold text-indigo-300 mb-6">Edit Coach Listing</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">First Name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Last Name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Favorite Sport</label>
            <input value={favoriteSport} onChange={(e) => setFavoriteSport(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Avatar URL</label>
            <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Years of Experience</label>
            <input type="number" min="0" value={experienceYrs} onChange={(e) => setExperienceYrs(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Certifications</label>
            <input value={certifications} onChange={(e) => setCertifications(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Hourly Rate ($)</label>
            <input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm" />
          </div>

          {error && <div className="bg-red-500/20 border border-red-500 rounded-lg px-4 py-3 text-sm text-red-300">{error}</div>}
          {success && <div className="bg-green-500/20 border border-green-500 rounded-lg px-4 py-3 text-sm text-green-300">Updated successfully!</div>}

          <button type="submit" disabled={submitting || success} className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-600 hover:to-fuchsia-600 disabled:from-neutral-700 disabled:to-neutral-700 text-white py-3 rounded-lg font-semibold transition">
            {submitting ? "Saving..." : success ? "Saved" : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
