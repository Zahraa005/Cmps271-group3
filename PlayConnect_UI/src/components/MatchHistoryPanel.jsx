// src/components/MatchHistoryPanel.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MatchHistoryPanel = ({ userId }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data used previously for testing:
    // const mockMatches = [
    //   {
    //     match_id: 1,
    //     opponent_id: 42,
    //     opponent_name: "Opponent Name 42",
    //     game_type: "1v1 Pickup",
    //     duration_minutes: 35,
    //     score_player: 3,
    //     score_opponent: 2,
    //     result: 'win',
    //     played_at: new Date().toISOString(),
    //   },
    //   {
    //     match_id: 2,
    //     opponent_id: 37,
    //     opponent_name: "Opponent Name 37",
    //     game_type: "1v1 Pickup",
    //     duration_minutes: 28,
    //     score_player: 1,
    //     score_opponent: 4,
    //     result: 'loss',
    //     played_at: new Date(Date.now() - 86400000).toISOString(),
    //   },
    //   {
    //     match_id: 3,
    //     opponent_id: 99,
    //     opponent_name: "Opponent Name 99",
    //     game_type: "1v1 Pickup",
    //     duration_minutes: 42,
    //     score_player: 2,
    //     score_opponent: 2,
    //     result: 'draw',
    //     played_at: new Date(Date.now() - 172800000).toISOString(),
    //   },
    //   {
    //     match_id: 4,
    //     opponent_id: 18,
    //     opponent_name: "Opponent Name 18",
    //     game_type: "1v1 Pickup",
    //     duration_minutes: 30,
    //     score_player: 5,
    //     score_opponent: 3,
    //     result: 'win',
    //     played_at: new Date(Date.now() - 259200000).toISOString(),
    //   },
    //   {
    //     match_id: 5,
    //     opponent_id: 77,
    //     opponent_name: "Opponent Name 77",
    //     game_type: "1v1 Pickup",
    //     duration_minutes: 25,
    //     score_player: 0,
    //     score_opponent: 1,
    //     result: 'loss',
    //     played_at: new Date(Date.now() - 345600000).toISOString(),
    //   },
    //   {
    //     match_id: 6,
    //     opponent_id: 25,
    //     opponent_name: "Opponent Name 25",
    //     game_type: "1v1 Pickup",
    //     duration_minutes: 38,
    //     score_player: 4,
    //     score_opponent: 4,
    //     result: 'draw',
    //     played_at: new Date(Date.now() - 432000000).toISOString(),
    //   },
    // ];

    const fetchHistory = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/match-history/${userId}`);
        setMatches(response.data);
      } catch (error) {
        console.error('Error fetching match history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  if (loading) return <div className="text-white text-center py-10">Loading match history...</div>;

  return (
    <div className="bg-neutral-950 text-white p-8 rounded-2xl shadow-lg border border-neutral-800 w-full mt-6">
      <h2 className="text-3xl font-bold mb-8">Match History</h2>
      {matches.length === 0 ? (
        <p className="text-neutral-500 text-center">You haven’t played any matches yet.</p>
      ) : (
        <div className="flex flex-col space-y-6">
          {matches.map((match) => (
            <div
              key={match.match_id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 transition p-6 rounded-xl"
            >
              <div className="flex flex-col gap-1">
                <div className="text-xl font-semibold">
                  You {match.score_player} — {match.score_opponent} vs Opponent #{match.opponent_id}
                </div>
                <div className="text-sm text-neutral-400">
                  {new Date(match.played_at).toLocaleString()} • {match.game_type} • {match.duration_minutes} min
                </div>
                <div className="text-xs text-neutral-500">vs {match.opponent_name}</div>
              </div>
              <div className="mt-4 sm:mt-0">
                <span
                  className={`text-sm font-semibold px-4 py-1 rounded-full border ${
                    match.result === 'win'
                      ? 'bg-green-500/10 text-green-400 border-green-500/40'
                      : match.result === 'loss'
                      ? 'bg-red-500/10 text-red-400 border-red-500/40'
                      : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/40'
                  }`}
                >
                  {match.result.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MatchHistoryPanel;