import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  
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
        setToast(result.error || "Login failed. Please check your credentials.");
      }
      
    } catch (error) {
      console.error('Login error:', error);
      setToast("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setToast("Password reset link sent to your email!");
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <main className="min-h-screen bg-neutral-950 relative overflow-hidden">
      {/* Background patterns - matching ProfileCreation */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0, 0 0",
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
          <div className="flex items-center gap-2 text-2xl font-bold text-white">
            <span>PlayConnect</span>
            <span></span>
          </div>
          <a 
            href="/" 
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
             Back to Home
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-neutral-400">Sign in to your PlayConnect account</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm mb-1 text-white">Email address</label>
            <div className="relative">
              <input
                type="email"
                className={classNames(
                  "w-full rounded-lg bg-neutral-950/70 border px-3 py-3 outline-none shadow-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors",
                  emailOk || !email
                    ? "border-neutral-800"
                    : "border-rose-500"
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
            <label className="block text-sm mb-1 text-white">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className={classNames(
                  "w-full rounded-lg bg-neutral-950/70 border px-3 py-3 pr-12 outline-none shadow-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors",
                  passwordOk || !password
                    ? "border-neutral-800"
                    : "border-rose-500"
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
                  className="text-neutral-400 hover:text-neutral-200 transition-colors focus:outline-none"
                  disabled={loading}
                >
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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
                disabled={loading}
              />
              <span className="text-sm text-neutral-300">Remember me</span>
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              disabled={loading}
            >
              Forgot password?
            </button>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={classNames(
              "w-full rounded-xl py-3 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950",
              canSubmit
                ? "bg-violet-500 text-white hover:bg-violet-400 active:scale-[0.99] shadow-lg shadow-violet-500/30"
                : "bg-neutral-800/80 text-neutral-500 cursor-not-allowed"
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

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-1 h-px bg-neutral-800"></div>
          <span className="px-4 text-sm text-neutral-500">or</span>
          <div className="flex-1 h-px bg-neutral-800"></div>
        </div>

        {/* Social login buttons */}
        <div className="space-y-3">
          <button
            type="button"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900/50 text-white py-3 font-medium hover:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
            disabled={loading}
          >
            <div className="flex items-center justify-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </div>
          </button>
        </div>

        {/* Sign up link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-neutral-400">
            Don't have an account?{" "}
            <a 
              href="/signup" 
              className="text-violet-400 hover:text-violet-300 transition-colors font-medium"
            >
              Sign up
            </a>
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 top-4 -translate-x-1/2 rounded-full bg-neutral-900 border border-neutral-700 px-4 py-2 text-sm text-neutral-100 shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}
