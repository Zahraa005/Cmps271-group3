import { useState } from "react";
import { Link } from "react-router-dom";
import API_BASE_URL from '../Api/config';

export default function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");

    if (!token) {
      setStatus("Missing token. Open the link from your email again.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reset-password`, {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.detail || "Failed to reset password.");
      } else {
        setStatus("Password reset ✅ You can now log in.");
      }
    } catch (err) {
      setStatus("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[rgb(var(--pc-bg))] text-neutral-900 dark:text-white relative overflow-hidden transition-colors duration-300">
      {/* background layers same as login */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(var(--pc-grid) 1px, transparent 1px), linear-gradient(90deg, var(--pc-grid) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 0 0",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(600px 300px at 20% 0%, var(--pc-g1), transparent 60%), radial-gradient(600px 300px at 80% 100%, var(--pc-g2), transparent 55%)",
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

      {/* top bar */}
      <div className="px-4 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 font-extrabold text-3xl tracking-wide italic">
              PlayConnect
            </span>
            <span className="animate-bounce ml-1">🏀🎾</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-sm text-neutral-500 dark:text-neutral-300 hover:text-white transition-colors"
          >
            Back to Home →
          </Link>
        </div>
      </div>

      {/* center card */}
      <div className="relative z-10 mx-auto max-w-md px-4 py-10">
        <div className="bg-neutral-900/50 dark:bg-neutral-900/50 backdrop-blur-md rounded-2xl border border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] p-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 mb-2 text-center">
            Reset password
          </h1>
          <p className="text-center text-sm text-neutral-300 mb-8">
            Enter your new password below.
          </p>

          {!token && (
            <p className="text-center text-sm text-rose-400 mb-4">
              No token in URL. Open the link from your email.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm mb-1 text-neutral-200">New password</label>
              <input
                type="password"
                className="w-full bg-neutral-900/40 border border-neutral-700/70 rounded-xl px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/40 transition shadow-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-neutral-200">Confirm password</label>
              <input
                type="password"
                className="w-full bg-neutral-900/40 border border-neutral-700/70 rounded-xl px-3 py-2 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/40 transition shadow-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-500 hover:bg-violet-400 disabled:opacity-50 py-2.5 rounded-xl font-semibold text-white transition shadow-[0_10px_40px_rgba(139,92,246,0.35)]"
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>

          {status && (
            <p className="mt-5 text-center text-sm text-neutral-100 bg-neutral-900/40 border border-neutral-700/30 rounded-xl py-2">
              {status}
            </p>
          )}

          <p className="mt-6 text-center text-sm text-neutral-400">
            Remembered it?{" "}
            <Link to="/login" className="text-violet-300 hover:text-violet-100">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}