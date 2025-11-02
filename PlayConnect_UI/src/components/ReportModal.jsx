import React, { useState } from "react";

const ReportModal = ({ isOpen, onClose, type, targetName }) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    // Later integrate backend call here
    console.log("Report submitted:", { type, targetName, reason, details });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8 w-[90%] max-w-md text-white shadow-2xl relative">
        <h3 className="text-2xl font-bold mb-4">
          Report {type === "player" ? "Player" : "Game"}
        </h3>
        <p className="text-sm text-neutral-400 mb-6">
          Reporting {type === "player" ? "player" : "match"}:{" "}
          <span className="font-semibold text-white">{targetName}</span>
        </p>

        {submitted ? (
          <div className="text-green-400 font-semibold text-center py-8">
            ✅ Report submitted successfully!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Reason dropdown */}
            <div>
              <label className="block text-sm mb-1 text-neutral-300">
                Reason
              </label>
              <select
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 outline-none focus:ring-2 focus:ring-violet-500"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                <option value="">Select reason</option>
                {type === "player" ? (
                  <>
                    <option value="harassment">Harassment or abuse</option>
                    <option value="fake_account">Fake or impersonating account</option>
                    <option value="spam">Spam or inappropriate messages</option>
                    <option value="other">Other</option>
                  </>
                ) : (
                  <>
                    <option value="cheating">Cheating or unfair play</option>
                    <option value="offensive_behavior">Offensive behavior</option>
                    <option value="match_issue">Match issue / score dispute</option>
                    <option value="other">Other</option>
                  </>
                )}
              </select>
            </div>

            {/* Details text area */}
            <div>
              <label className="block text-sm mb-1 text-neutral-300">
                Additional details (optional)
              </label>
              <textarea
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg p-2 outline-none resize-none focus:ring-2 focus:ring-violet-500"
                rows={4}
                placeholder="Describe what happened..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-neutral-700 hover:bg-neutral-600 transition text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 transition text-sm font-semibold"
              >
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
