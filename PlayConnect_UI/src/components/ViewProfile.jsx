import React, { useEffect, useState } from "react";
import ReportModal from "./ReportModal";

const API_BASE = import.meta?.env?.VITE_API_URL || "http://localhost:8000";

/**
 * Props:
 * - userId: number (required)
 * - currentUserId: number (required)
 * - onClose: () => void
 * - initialUser?: object (optional seed data to avoid refetch)
 */
const ViewProfile = ({ userId, currentUserId, onClose, initialUser }) => {
  const [user, setUser] = useState(initialUser || null);
  const [mutualCount, setMutualCount] = useState(
    typeof initialUser?.mutual_count === "number" ? initialUser.mutual_count : 0
  );
  const [loading, setLoading] = useState(!initialUser);
  const [error, setError] = useState("");
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (!userId || initialUser) return; // already have data
    let canceled = false;

    const fetchProfile = async () => {
      try {
        setLoading(true);

        // 1) Already friends
        let res = await fetch(`${API_BASE}/friends/my?user_id=${currentUserId}`);
        if (res.ok) {
          const edges = await res.json();
          const found = edges.map(e => e.friend).find(f => f.user_id === userId);
          if (found && !canceled) {
            setUser(found);
            setMutualCount(found.mutual_count ?? 0);
            setLoading(false);
            return;
          }
        }

        // 2) Incoming requests (they requested me)
        res = await fetch(`${API_BASE}/friends/requests?user_id=${currentUserId}`);
        if (res.ok) {
          const edges = await res.json();
          const found = edges.map(e => e.friend).find(f => f.user_id === userId);
          if (found && !canceled) {
            setUser(found);
            setMutualCount(found.mutual_count ?? 0);
            setLoading(false);
            return;
          }
        }

        // 3) Pending I sent (the problematic tab)
        res = await fetch(`${API_BASE}/friends/sent?user_id=${currentUserId}`);
        if (res.ok) {
          const edges = await res.json();
          const found = edges.map(e => e.friend).find(f => f.user_id === userId);
          if (found && !canceled) {
            setUser(found);
            setMutualCount(found.mutual_count ?? 0);
            setLoading(false);
            return;
          }
        }

        // 4) Discover (no relation)
        res = await fetch(`${API_BASE}/friends/find?user_id=${currentUserId}`);
        if (res.ok) {
          const list = await res.json();
          const found = list.find(u => u.user_id === userId);
          if (found && !canceled) {
            setUser(found);
            setMutualCount(found.mutual_count ?? 0);
            setLoading(false);
            return;
          }
        }

        // 5) Fallback: /users (last resort)
        res = await fetch(`${API_BASE}/users`);
        if (res.ok) {
          const list = await res.json();
          const found = list.find(u => u.user_id === userId);
          if (found && !canceled) {
            setUser(found);
            setMutualCount(found.mutual_count ?? 0);
            setLoading(false);
            return;
          }
        }

        if (!canceled) {
          setError("User not found");
        }
      } catch (err) {
        if (!canceled) setError(err.message || "Error fetching user");
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    fetchProfile();
    return () => { canceled = true; };
  }, [userId, currentUserId, initialUser]);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 w-[90%] max-w-md text-white shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-neutral-400 hover:text-white text-xl leading-none"
        >
          ×
        </button>

        {loading ? (
          <div className="flex justify-center items-center py-10 text-neutral-400">
            <svg className="animate-spin h-5 w-5 text-neutral-300" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
          </div>
        ) : error ? (
          <div className="text-red-400 text-center py-10">{error}</div>
        ) : !user ? (
          <div className="text-neutral-400 text-center py-10">User not found</div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={`${user.first_name || ""} ${user.last_name || ""}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-lg">
                    {(user.first_name?.[0] || "?") + (user.last_name?.[0] || "")}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {user.first_name || ""} {user.last_name || ""}
                </h2>
                <p className="text-neutral-400 text-sm">
                  {user.favorite_sport || "No sport listed"}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold text-neutral-300">Email:</span> {user.email || "Hidden"}</p>
              <p><span className="font-semibold text-neutral-300">Mutual friends:</span> {mutualCount}</p>
              <p><span className="font-semibold text-neutral-300">User ID:</span> {user.user_id}</p>
            </div>

            {/* Footer Buttons */}
            <div className="mt-8 flex flex-col gap-2">
              <button
                onClick={() => setShowReport(true)}
                className="w-full py-2 !bg-red-500 hover:!bg-red-600 text-white rounded-lg font-medium transition"
              >
                Report Player
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>

            {/* Report Modal */}
            {showReport && (
              <ReportModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                type="player"
                targetName={`${user.first_name || ""} ${user.last_name || ""}`}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewProfile;
