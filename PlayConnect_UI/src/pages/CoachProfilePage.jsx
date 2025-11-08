import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Star, MapPin, Calendar, MessageCircle, Heart, Share2, Award, Users, Clock, CheckCircle, Video } from "lucide-react";
import axios from "axios";
import API_BASE_URL from '../Api/config';

export default function CoachProfilePage() {
  const { coachId } = useParams();
  const [tab, setTab] = useState("about");
  const [isFavorite, setIsFavorite] = useState(false);
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("role");
    window.location.href = "/login";
  };

  useEffect(() => {
    const fetchCoach = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/coaches/${coachId}`);
        if (!res.ok) throw new Error("Coach not found");
        const data = await res.json();
        setCoach(data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching coach:", err);
        setError("Failed to load coach profile");
        setLoading(false);
      }
    };

    fetchCoach();
  }, [coachId]);

  const getInitials = (firstName, lastName) => {
    const first = firstName || "";
    const last = lastName || "";
    if (!first && !last) return "?";
    if (!last) return first[0]?.toUpperCase() || "?";
    return (first[0] + last[0]).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        Loading coach profile...
      </div>
    );
  }

  if (error || !coach) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-red-400">
        {error || "Coach not found"}
      </div>
    );
  }

  const certificationsList = coach.certifications ? coach.certifications.split(",").map(c => c.trim()) : [];

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
        <a href="/" className="flex items-center gap-2 text-2xl font-bold hover:opacity-90 transition-opacity">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
            PlayConnect
          </span>
          <span>🏀🎾</span>
        </a>

        <div className="flex items-center gap-5">
          <a href="/coaches" className="text-white hover:text-neutral-100 text-sm transition">
            ← Back to Coaches
          </a>
          <a href="/dashboard" className="text-white hover:text-neutral-100 text-sm transition">
            Dashboard
          </a>
          <button
            onClick={handleLogout}
            className="bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg font-semibold text-sm transition text-white"
          >
            Logout
          </button>
        </div>
      </div>

      {/* === Hero Section === */}
      <div className="max-w-6xl mx-auto px-10 pt-8 pb-12 relative z-10">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-indigo-900/40 to-fuchsia-900/40 p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              {/* Avatar */}
              <div className="relative">
                {coach.avatar_url && coach.avatar_url.trim() !== "" ? (
                  <img
                    src={coach.avatar_url}
                    alt={`${coach.first_name} ${coach.last_name}`}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentNode.querySelector(".fallback-avatar").style.display = "flex";
                    }}
                    className="w-32 h-32 rounded-full object-cover border-4 border-neutral-900"
                  />
                ) : null}

                <div
                  className="fallback-avatar w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-4xl border-4 border-neutral-900"
                  style={{ display: coach.avatar_url ? "none" : "flex" }}
                >
                  {getInitials(coach.first_name, coach.last_name)}
                </div>

                {coach.isverified && (
                  <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 border-4 border-neutral-900">
                    <CheckCircle size={24} className="text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-start gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-white">
                    {coach.first_name} {coach.last_name}
                  </h1>
                  {coach.isverified && (
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                      <CheckCircle size={14} /> Verified Coach
                    </span>
                  )}
                </div>
                <p className="text-fuchsia-300 text-lg mb-3">{coach.favorite_sport || "Sports Coach"}</p>
                
                {/* Stats Row */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1 text-neutral-400">
                    <Clock size={16} />
                    <span>{coach.experience_yrs} years experience</span>
                  </div>
                  {certificationsList.length > 0 && (
                    <div className="flex items-center gap-1 text-neutral-400">
                      <Award size={16} />
                      <span>{certificationsList.length} certification{certificationsList.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <button
                  onClick={async () => {
                    try {
                      const userId = Number(localStorage.getItem("user_id"));
                      if (!userId) {
                        alert("Please log in before booking a session.");
                        return;
                      }

                      const response = await axios.post(`${API_BASE_URL}/book-session`, {
                        game_id: coach.coach_id,
                        user_id: userId,
                      });

                      alert(response.data.message || "Session booked successfully!");
                    } catch (err) {
                      console.error("Booking error:", err);
                      if (err.response?.data?.detail) {
                        alert(`Error: ${err.response.data.detail}`);
                      } else {
                        alert("Something went wrong while booking the session.");
                      }
                    }
                  }}
                  className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-600 hover:to-fuchsia-600 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-500/30"
                >
                  <Calendar size={18} />
                  Book Session
                </button>
                  
                <div className="flex gap-2">
                  <button className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg transition flex items-center justify-center gap-2">
                    <MessageCircle size={16} />
                    Message
                  </button>
                  <button 
                    onClick={() => setIsFavorite(!isFavorite)}
                    className={`${isFavorite ? 'bg-fuchsia-600' : 'bg-neutral-800'} hover:bg-fuchsia-700 text-white px-4 py-2 rounded-lg transition`}
                  >
                    <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                  <button className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg transition">
                    <Share2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-6 p-6 bg-neutral-900/50 border-t border-neutral-800">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-indigo-400 mb-1">
                <Clock size={20} />
              </div>
              <p className="text-2xl font-bold text-white">{coach.experience_yrs}+</p>
              <p className="text-xs text-neutral-400">Years Experience</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-fuchsia-400 mb-1">
                <Award size={20} />
              </div>
              <p className="text-2xl font-bold text-white">{certificationsList.length}</p>
              <p className="text-xs text-neutral-400">Certifications</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-green-400 mb-1">
                <CheckCircle size={20} />
              </div>
              <p className="text-2xl font-bold text-white">{coach.isverified ? "Verified" : "Pending"}</p>
              <p className="text-xs text-neutral-400">Status</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mt-8 mb-6 border-b border-neutral-800">
          {["about", "reviews", "availability"].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`px-6 py-3 font-semibold transition-all relative ${
                tab === item
                  ? "text-fuchsia-300"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {item === "about" && "About"}
              {item === "reviews" && "Reviews"}
              {item === "availability" && "Availability"}
              {tab === item && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-fuchsia-500"></div>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "about" && (
          <div className="grid md:grid-cols-3 gap-6">
            {/* Left Column - Bio */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-xl font-bold text-fuchsia-300 mb-4">About Me</h3>
                <p className="text-neutral-300 leading-relaxed">
                  {coach.bio || "This coach hasn't added a bio yet."}
                </p>
              </div>

              {/* Certifications */}
              {certificationsList.length > 0 && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-fuchsia-300 mb-4">Certifications</h3>
                  <div className="space-y-2">
                    {certificationsList.map((cert, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-neutral-300">
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        <span>{cert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Pricing */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-indigo-900/40 to-fuchsia-900/40 border border-indigo-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-2">Session Price</h3>
                <p className="text-3xl font-bold text-fuchsia-300 mb-4">
                  ${coach.hourly_rate}/hour
                </p>
                <p className="text-xs text-neutral-400">Contact for package deals</p>
              </div>
            </div>
          </div>
        )}

        {tab === "reviews" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-xl font-bold text-fuchsia-300 mb-6">Student Reviews</h3>
            <div className="text-center py-12 text-neutral-400">
              <p className="text-sm">No reviews yet. Be the first to review this coach!</p>
            </div>
          </div>
        )}

        {tab === "availability" && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-xl font-bold text-fuchsia-300 mb-6">Weekly Availability</h3>
            <div className="text-center py-12 text-neutral-400">
              <p className="text-sm">Contact coach to discuss availability and schedule sessions.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}