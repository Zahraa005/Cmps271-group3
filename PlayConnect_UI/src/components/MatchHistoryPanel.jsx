import React, { useEffect, useState } from "react";
import ReportModal from "./ReportModal";

const MatchHistoryPanel = ({ userId }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    // --------------------------------------------------------------------
    // 🧪 Temporary mock data for UI design (commented out)
    // const mockMatches = [
    //   {
    //     match_id: 1,
    //     opponent_id: 42,
    //     opponent_name: "Opponent Name 42",
    //     game_type: "1v1 Pickup",
    //     location: "Beirut Arena",
    //     duration_minutes: 35,
    //     score_player: 3,
    //     score_opponent: 2,
    //     result: "win",
    //     cost: "$10",
    //     played_at: new Date().toISOString(),
    //   },
    //   {
    //     match_id: 2,
    //     opponent_id: 37,
    //     opponent_name: "Opponent Name 37",
    //     game_type: "1v1 Pickup",
    //     location: "Byblos Court",
    //     duration_minutes: 28,
    //     score_player: 1,
    //     score_opponent: 4,
    //     result: "loss",
    //     cost: "$8",
    //     played_at: new Date(Date.now() - 86400000).toISOString(),
    //   },
    //   {
    //     match_id: 3,
    //     opponent_id: 99,
    //     opponent_name: "Opponent Name 99",
    //     game_type: "1v1 Pickup",
    //     location: "Tripoli Park",
    //     duration_minutes: 42,
    //     score_player: 2,
    //     score_opponent: 2,
    //     result: "draw",
    //     cost: "$12",
    //     played_at: new Date(Date.now() - 172800000).toISOString(),
    //   },
    // ];
    // setMatches(mockMatches);
    // setLoading(false);
    // --------------------------------------------------------------------

    // ✅ Fetch actual match history from API (uncomment when backend is ready)
    const fetchHistory = async () => {
      try {
        const res = await fetch(`http://localhost:8000/match-history/${userId}`);
        if (!res.ok) throw new Error(`Failed to fetch match history: ${res.status}`);
        const data = await res.json();
        setMatches(data);
      } catch (err) {
        console.error("Error fetching match history:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [userId]);

  const closeModal = () => setSelectedMatch(null);

  if (loading)
    return (
      <div className="text-white text-center py-10">
        Loading match history...
      </div>
    );

  return (
    <div className="bg-neutral-950 text-white p-8 rounded-2xl shadow-lg border border-neutral-800 w-full mt-6">
      <h2 className="text-3xl font-bold mb-8">Match History</h2>

      {matches.length === 0 ? (
        <p className="text-neutral-500 text-center">
          You haven’t played any matches yet.
        </p>
      ) : (
        <div className="flex flex-col space-y-6">
          {matches.map((match) => (
            <div
              key={match.match_id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 transition p-6 rounded-xl"
            >
              <div className="flex flex-col gap-1">
                <div className="text-xl font-semibold">
                  {match.score_player} — {match.score_opponent}, You vs Opponent #
                  {match.opponent_id}
                </div>
                <div className="text-sm text-neutral-400">
                  {new Date(match.played_at).toLocaleString()} • {match.game_type} •{" "}
                  {match.duration_minutes} min
                </div>
                <div className="text-xs text-neutral-500">
                  vs {match.opponent_name}
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4 sm:mt-0">
                {/* View Button */}
                <button
                  onClick={() => setSelectedMatch(match)}
                  className="text-sm font-medium px-4 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 transition"
                >
                  View
                </button>

                {/* Result Badge */}
                <span
                  className={`text-sm font-semibold px-4 py-1 rounded-full border ${
                    match.result === "win"
                      ? "bg-green-500/10 text-green-400 border-green-500/40"
                      : match.result === "loss"
                      ? "bg-red-500/10 text-red-400 border-red-500/40"
                      : "bg-yellow-500/10 text-yellow-300 border-yellow-500/40"
                  }`}
                >
                  {match.result.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------ Match Details Modal ------------------ */}
      {selectedMatch && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 w-[90%] max-w-md text-white shadow-2xl relative">
            <h3 className="text-2xl font-bold mb-4">Match Details</h3>

            <p className="text-neutral-300 mb-1">
              <span className="font-semibold text-neutral-100">Date:</span>{" "}
              {new Date(selectedMatch.played_at).toLocaleString()}
            </p>
            <p className="text-neutral-300 mb-1">
              <span className="font-semibold text-neutral-100">Location:</span>{" "}
              {selectedMatch.location}
            </p>
            <p className="text-neutral-300 mb-1">
              <span className="font-semibold text-neutral-100">Game Type:</span>{" "}
              {selectedMatch.game_type}
            </p>
            <p className="text-neutral-300 mb-1">
              <span className="font-semibold text-neutral-100">Duration:</span>{" "}
              {selectedMatch.duration_minutes} min
            </p>
            <p className="text-neutral-300 mb-1">
              <span className="font-semibold text-neutral-100">Opponent:</span>{" "}
              {selectedMatch.opponent_name}
            </p>
            <p className="text-neutral-300 mb-1">
              <span className="font-semibold text-neutral-100">Result:</span>{" "}
              <span
                className={
                  selectedMatch.result === "win"
                    ? "text-green-400"
                    : selectedMatch.result === "loss"
                    ? "text-red-400"
                    : "text-yellow-300"
                }
              >
                {selectedMatch.result.toUpperCase()}
              </span>
            </p>
            <p className="text-neutral-300 mb-6">
              <span className="font-semibold text-neutral-100">Cost:</span>{" "}
              {selectedMatch.cost}
            </p>

            {/* Report Game Button */}
            <button
              onClick={() => setShowReport(true)}
              className="w-full mt-2 mb-1 bg-red-600 hover:bg-red-700 transition text-white py-2 rounded-lg font-semibold"
            >
              Report Game
            </button>

            {/* Report Modal */}
            {showReport && (
              <ReportModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                type="game"
                targetName={`Match #${selectedMatch.match_id}`}
              />
            )}

            {/* Close Button */}
            <button
              onClick={closeModal}
              className="w-full bg-violet-600 hover:bg-violet-700 transition text-white py-2 rounded-lg font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchHistoryPanel;
