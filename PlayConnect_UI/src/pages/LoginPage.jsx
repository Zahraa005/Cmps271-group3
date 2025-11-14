import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "../theme/ThemeToggle";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from '../Api/config';

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoadingForgot, setIsLoadingForgot] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [needsVerification, setNeedsVerification] = useState(false);
  
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Form validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailOk = email.trim().length > 0 && emailRegex.test(email);
  const passwordOk = password.length >= 4;
  const canSubmit = emailOk && passwordOk && !loading;

  // Clear errors when user starts typing
  useEffect(() => {
    if (errors.email && email.trim().length > 0) {
      setErrors(prev => ({ ...prev, email: null }));
    }
  }, [email, errors.email]);

  useEffect(() => {
    if (errors.password && password.length > 0) {
      setErrors(prev => ({ ...prev, password: null }));
    }
  }, [password, errors.password]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Toast cleanup
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErrors({});

    try {
      const result = await login(email, password);
      
      if (result.success) {
        setToast("Login successful! Redirecting...");
        navigate('/dashboard');
      } else {
        if (result.needsVerification) {
          setNeedsVerification(true);
          setToast(result.error);
        } else {
          setToast(result.error || "Login failed. Please check your credentials.");
        }
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setToast("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    // Require a valid email first
    if (!emailOk) {
      setToast("Enter a valid email first.");
      return;
    }
    try {
      setIsLoadingForgot(true);
      // Use Vite env var with sensible local fallback
      const res = await fetch(`${API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast("If that email exists, a reset link was sent.");
        // Optional: log preview for dev
        if (data.preview_html) {
          // eslint-disable-next-line no-console
          console.log("[DEV] reset email preview:", data.preview_html);
        }
      } else {
        setToast(data?.detail || "Could not send reset email.");
      }
    } catch (err) {
      console.error("forgot-password error", err);
      setToast("Network error. Try again.");
    } finally {
      setIsLoadingForgot(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <main className="min-h-screen bg-[rgb(var(--pc-bg))] text-neutral-900 dark:text-white relative overflow-hidden transition-colors duration-300">
      {/* Background patterns - matching ProfileCreation */}
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

      {/* Navigation */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center gap-2">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 font-extrabold text-3xl sm:text-4xl tracking-wide animate-pulse italic">
                PlayConnect
              </span>
              <span className="animate-bounce ml-1">🏀🎾</span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <a
              href="/"
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors focus:outline-none"
            >
              <span>Back to Home</span>
              <svg className="h-5 w-5 translate-x-0 transition-transform duration-200 group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 animate-pulse">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Sign in to your PlayConnect account</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label id="emailaddy" className="block text-sm mb-1 text-neutral-800 dark:text-white">Email address</label>
            <div className="relative">
              <input id="passwordInput"
                type="email"
                className={classNames(
                  "w-full rounded-xl border px-4 py-3 outline-none shadow-md focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-300 hover:border-violet-400 bg-white text-neutral-900 placeholder-neutral-500 dark:bg-neutral-900/60 dark:text-white",
                  emailOk || !email ? "border-neutral-300 dark:border-neutral-700" : "border-rose-500"
                )}
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              {emailOk && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="h-5 w-5 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.9a1 1 0 111.4-1.4l3 3 6.7-6.7a1 1 0 011.4 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            {!emailOk && email && (
              <p className="mt-1 text-xs text-rose-400">Please enter a valid email address.</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label id="emailaddy" className="block text-sm mb-1 text-neutral-800 dark:text-white">Password</label>
            <div className="relative">
              <input id="passwordInput"
                type={showPassword ? "text" : "password"}
                className={classNames(
                  "w-full rounded-xl border px-4 py-3 outline-none shadow-md focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition-all duration-300 hover:border-violet-400 bg-white text-neutral-900 placeholder-neutral-500 dark:bg-neutral-900/60 dark:text-white",
                  passwordOk || !password ? "border-neutral-300 dark:border-neutral-700" : "border-rose-500"
                )}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {passwordOk && (
                  <svg className="h-5 w-5 text-violet-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.9a1 1 0 111.4-1.4l3 3 6.7-6.7a1 1 0 011.4 0z" clipRule="evenodd" />
                  </svg>
                )}
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="flex items-center justify-center h-9 w-9 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 hover:from-violet-500/30 hover:to-fuchsia-500/30 text-violet-400 hover:text-fuchsia-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 focus:ring-offset-neutral-900 disabled:opacity-50"
                  disabled={loading}
                >
                  <span className="text-lg">⃠</span>
                  {showPassword ? (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {!passwordOk && password && (
              <p className="mt-1 text-xs text-rose-400">Password must be at least 4 characters.</p>
            )}
          </div>

          {/* Remember me and Forgot password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-5 w-5 rounded-md border border-neutral-400 dark:border-neutral-600 bg-white dark:bg-neutral-900/60 accent-violet-500 shadow-inner transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-neutral-900 disabled:opacity-50"
                disabled={loading}
              />
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white tracking-wide">Remember me</span>
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300 transition-colors font-medium disabled:opacity-60"
              disabled={loading || isLoadingForgot}
              aria-busy={isLoadingForgot}
            >
              <span>{isLoadingForgot ? "Sending…" : "Forgot password?"}</span>
            </button>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={classNames(
              "w-full rounded-xl py-3 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
              canSubmit
                ? "bg-violet-500 text-white font-semibold hover:bg-violet-400 active:scale-[0.99] shadow-lg shadow-violet-500/30"
                : "bg-neutral-800/80 text-white/40 cursor-not-allowed"
            )}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
                Signing in...
              </div>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        {/* Email Verification Prompt */}
        {needsVerification && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Email Verification Required
                </h3>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  Please check your email for a verification link. If you don't see it, check your spam folder.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => navigate("/verify-email")}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors"
                  >
                    Verify Email
                  </button>
                  <button
                    onClick={() => setNeedsVerification(false)}
                    className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800"></div>
          <span className="px-4 text-sm text-neutral-500">or</span>
          <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800"></div>
        </div>


        {/* Sign up link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Don't have an account?{" "}
            <a 
              href="/signup" 
              className="text-violet-600 hover:text-violet-500 dark:text-violet-400 dark:hover:text-violet-300 transition-colors font-medium"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-4 -translate-x-1/2 rounded-full bg-white text-neutral-900 border border-neutral-300 dark:bg-neutral-900 dark:text-neutral-100 dark:border-neutral-700 px-4 py-2 text-sm shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
