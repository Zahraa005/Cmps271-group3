import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import ThemeToggle from "../theme/ThemeToggle";
import API_BASE_URL from '../Api/config';

export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying"); // verifying, success, error
  const [message, setMessage] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const emailFromUrl = searchParams.get("email");

  useEffect(() => {
    console.log("EmailVerificationPage mounted, emailFromUrl:", emailFromUrl);
    if (emailFromUrl) {
      verifyEmail(emailFromUrl);
    } else {
      setStatus("error");
      setMessage("No email address provided.");
    }
  }, [emailFromUrl]);

  const verifyEmail = async (emailAddress) => {
    console.log("Attempting to verify email:", emailAddress);
    try {
      const response = await fetch(`${API_BASE_URL}/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailAddress }),
      });

      console.log("Verification response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Verification success:", data);
        setStatus("success");
        setMessage(data.message);
      } else {
        const errorData = await response.json();
        console.log("Verification error:", errorData);
        setStatus("error");
        setMessage(errorData.detail || "Verification failed");
      }
    } catch (error) {
      console.log("Verification network error:", error);
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const resendVerification = async () => {
    if (!emailInput.trim()) {
      setMessage("Please enter your email address.");
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/resend-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: emailInput }),
      });

      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage("Failed to resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[rgb(var(--pc-bg))] text-neutral-900 dark:text-white relative overflow-hidden transition-colors duration-300">
      {/* Background patterns */}
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
        <div className="bg-white/80 dark:bg-neutral-900/80 rounded-xl shadow-xl p-8 border border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
          
          {status === "verifying" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400">
                  Verifying Your Email
                </h1>
                <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                  Please wait while we verify your email address...
                </p>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-green-600 dark:text-green-400">
                  Email Verified Successfully!
                </h1>
                <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                  {message}
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/login")}
                  className="w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white font-semibold py-3 rounded-xl hover:brightness-110 transition-all duration-300"
                >
                  Continue to Login
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="w-full bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white font-medium py-3 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  Go to Homepage
                </button>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="mx-auto w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
                  Verification Failed
                </h1>
                <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                  {message}
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Enter your email to resend verification:
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-lg bg-white/70 dark:bg-neutral-950/70 border border-neutral-300 dark:border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                  />
                </div>
                
                <button
                  onClick={resendVerification}
                  disabled={isResending || !emailInput.trim()}
                  className="w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 text-white font-semibold py-3 rounded-xl hover:brightness-110 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? "Sending..." : "Resend Verification Email"}
                </button>
                
                <button
                  onClick={() => navigate("/login")}
                  className="w-full bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-white font-medium py-3 rounded-xl hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
