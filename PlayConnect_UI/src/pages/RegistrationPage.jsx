import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "../theme/ThemeToggle";

export default function RegistrationPage() {
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        age: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const navigate = useNavigate();
    const { login } = useAuth();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitted(true);
        setErrorMessage("");

        if (form.password !== form.confirmPassword) return;

        // Basic age validation
        const ageInt = parseInt(form.age, 10);
        if (Number.isNaN(ageInt) || ageInt < 0) {
            setErrorMessage("Please enter a valid age.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch("http://127.0.0.1:8000/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password,
                    first_name: form.firstName,
                    last_name: form.lastName,
                    age: ageInt,
                    created_at: new Date().toISOString(),
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || "Registration failed");
            }

            // On success, store onboarding seed for profile page prefill
            let regData = null;
            try {
                regData = await response.json();
            } catch (_) {
                regData = null;
            }
            const seed = {
                user_id: regData?.user_id ?? undefined,
                first_name: form.firstName,
                last_name: form.lastName,
                age: ageInt,
                email: form.email,
            };
            try {
                localStorage.setItem("onboarding_seed", JSON.stringify(seed));
            } catch (_) {}

            // Auto-login so onboarding can also rely on auth if available
            try {
                await login(form.email, form.password);
            } catch (_) {
                // ignore login failure, still navigate
            }
            // Then go to onboarding
            navigate("/onboarding/profile");
        } catch (err) {
            setErrorMessage(err?.message || "Registration failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const passwordsMatch =
        form.password === form.confirmPassword || !submitted;

    // Generate emojis ONCE (doesn’t reset on typing)
    const EMOJIS = ["🏀", "🎾", "⚽", "🏐", "🏈", "🏓", "🏸", "🥎", "🏒", "🥏", "🏏", "🥊", "⛳"];
    const sprites = useMemo(() => {
        return Array.from({ length: 15 }).map((_, i) => {
            const emoji = EMOJIS[i % EMOJIS.length];
            const size = 30 + Math.floor(Math.random() * 20); 
            const startX = Math.random() * 100;
            const startY = Math.random() * 100;

            // Random direction across screen
            const directions = [
                { dx: 100, dy: 0 },   // → right
                { dx: -100, dy: 0 },  // → left
                { dx: 0, dy: 100 },   // ↓ down
                { dx: 0, dy: -100 },  // ↑ up
                { dx: 100, dy: 100 }, // diagonal ↘
                { dx: -100, dy: -100 }, // diagonal ↖
                { dx: -100, dy: 100 },  // diagonal ↙
                { dx: 100, dy: -100 },  // diagonal ↗
            ];
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const duration = 25 + Math.random() * 20; // 25–45s

            return {
                emoji,
                size,
                startX,
                startY,
                dx: dir.dx,
                dy: dir.dy,
                duration,
                delay: -(Math.random() * 20), // offset start
                opacity: 0.50 + Math.random() * 0.50,
            };
        });
    }, []); 

    return (
        <div className="min-h-screen bg-[rgb(var(--pc-bg))] text-neutral-900 dark:text-white relative overflow-hidden flex flex-col transition-colors duration-300">
            <style>{`
        @keyframes fly {
          0%   { transform: translate(0, 0); }
          100% { transform: translate(var(--dx), var(--dy)); }
        }
      `}</style>

            {/* Emoji layer */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {sprites.map((s, idx) => (
                    <span
                        key={idx}
                        style={{
                            position: "absolute",
                            top: `${s.startY}%`,
                            left: `${s.startX}%`,
                            fontSize: `${s.size}px`,
                            opacity: s.opacity,
                            animation: `fly ${s.duration}s linear infinite`,
                            animationDelay: `${s.delay}s`,
                            "--dx": `${s.dx}vw`,
                            "--dy": `${s.dy}vh`,
                            filter: "blur(1.5px)",
                            userSelect: "none",
                        }}
                    >
                        {s.emoji}
                    </span>
                ))}
            </div>

            {/* Navbar */}
            <nav className="relative z-10 bg-white/70 dark:bg-neutral-900/80 backdrop-blur px-6 py-4 flex justify-between items-center shadow-lg border-b border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
                <Link to="/" className="flex items-center gap-2 text-3xl font-extrabold hover:opacity-80">
                    <span className="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent italic">
                      PlayConnect
                    </span>
                    <span className="text-2xl animate-bounce">🏀</span>
                    <span className="text-2xl animate-bounce [animation-delay:0.3s]">🎾</span>
                </Link>
                <div className="flex gap-4">
                    <ThemeToggle />
                    <a
                        href="/login"
                        className="px-4 py-2 rounded-lg font-semibold shadow transition bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 
                            hover:brightness-110 text-white !text-white"
                    >
                        Login
                    </a>

                    {/* Home button removed */}
                </div>
            </nav>

            {/* Registration Card */}
            <main className="relative z-10 flex-grow flex items-center justify-center px-4">
                <div className="w-full max-w-md bg-white/80 dark:bg-neutral-900/80 rounded-xl shadow-xl p-8 border border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
                    <h2 className="text-4xl font-semibold text-center mb-2">Start Playing Today</h2>
                    <p className="text-neutral-400 text-center mb-6">
                        Your sports community is just one sign up away!
                    </p>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        {/* First & Last Name */}
                        <div className="flex gap-3">
                            <input
                                type="text"
                                name="firstName"
                                placeholder="First name"
                                value={form.firstName}
                                onChange={handleChange}
                                className="w-1/2 rounded-lg bg-white/70 dark:bg-neutral-950/70 border border-neutral-300 dark:border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                                required
                            />
                            <input
                                type="text"
                                name="lastName"
                                placeholder="Last name"
                                value={form.lastName}
                                onChange={handleChange}
                                className="w-1/2 rounded-lg bg-white/70 dark:bg-neutral-950/70 border border-neutral-300 dark:border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                                required
                            />
                        </div>

                        {/* Email */}
                        <input
                            type="email"
                            name="email"
                            placeholder="Email"
                            value={form.email}
                            onChange={handleChange}
                            className="w-full rounded-lg bg-white/70 dark:bg-neutral-950/70 border border-neutral-300 dark:border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                            required
                        />

                        {/* Age */}
                        <input
                            type="number"
                            name="age"
                            placeholder="Age"
                            value={form.age}
                            onChange={handleChange}
                            className="w-full rounded-lg bg-white/70 dark:bg-neutral-950/70 border border-neutral-300 dark:border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                            min="0"
                            required
                        />

                        {/* Password */}
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder="Password"
                                value={form.password}
                                onChange={handleChange}
                                className="w-full rounded-lg bg-white/70 dark:bg-neutral-950/70 border border-neutral-300 dark:border-neutral-700 px-3 py-2 pr-14 outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
                                required
                            />
                            <span
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-3 flex items-center text-sm text-violet-300 hover:text-violet-200 cursor-pointer select-none"
                            >
                                {showPassword ? "Hide" : "Show"}
                            </span>
                        </div>

                        {/* Confirm Password */}
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                name="confirmPassword"
                                placeholder="Confirm password"
                                value={form.confirmPassword}
                                onChange={handleChange}
                                className={`w-full rounded-lg bg-white/70 dark:bg-neutral-950/70 border px-3 py-2 pr-14 outline-none focus:ring-2 ${submitted && form.password !== form.confirmPassword
                                    ? "border-rose-500 ring-1 ring-rose-500"
                                    : "border-neutral-300 dark:border-neutral-700 focus:ring-violet-500"
                                    } transition-colors`}
                                required
                            />
                            <span
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-3 flex items-center text-sm text-violet-300 hover:text-violet-200 cursor-pointer select-none"
                            >
                                {showConfirmPassword ? "Hide" : "Show"}
                            </span>
                        </div>
                        {submitted && form.password !== form.confirmPassword && (
                            <p className="text-xs text-rose-400 -mt-1">Passwords do not match</p>
                        )}
                        {errorMessage && (
                            <p className="text-sm text-rose-400 -mt-1">{errorMessage}</p>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full rounded-lg text-white font-semibold px-4 py-2 shadow transition bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 ${isSubmitting ? "opacity-70 cursor-not-allowed" : "hover:brightness-110"}`}
                        >
                            {isSubmitting ? "Signing Up..." : "Sign Up"}
                        </button>
                    </form>

                    {/* Switch */}
                    <p className="text-sm text-neutral-400 mt-4 text-center">
                        Already have an account?{" "}
                        <a href="/login" className="text-violet-400 hover:underline">
                            Log in
                        </a>
                    </p>
                </div>
            </main>

            <footer className="relative z-10 w-full bg-neutral-100/80 dark:bg-gray-900/80 backdrop-blur text-neutral-700 dark:text-gray-300 py-6 mt-12 border-t border-neutral-200 dark:border-neutral-800 transition-colors duration-300">
                <div className="w-full flex justify-between items-center px-12">
                    {/* Left side */}
                    <p>&copy; 2025 PlayConnect. All rights reserved.</p>

                    {/* Right side */}
                    <div className="flex gap-8">
                        <a href="#" className="hover:text-white transition">About</a>
                        <a href="#" className="hover:text-white transition">Contact</a>
                    </div>
                </div>
            </footer>

        </div>
    );
}
