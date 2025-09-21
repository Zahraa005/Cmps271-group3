import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function RegistrationPage() {
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const navigate = useNavigate();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitted(true);
        if (form.password !== form.confirmPassword) return;
        navigate("/onboarding/profile");
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
                opacity: 0.12 + Math.random() * 0.18,
            };
        });
    }, []); 

    return (
        <div className="min-h-screen bg-neutral-950 text-white relative overflow-hidden flex flex-col">
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
            <nav className="relative z-10 bg-neutral-900/80 backdrop-blur px-6 py-4 flex justify-between items-center shadow-lg border-b border-neutral-800">
                <Link to="/" className="flex items-center gap-2 text-2xl font-bold hover:opacity-80">
                    <span>PlayConnect</span>
                    <span>⚽🏀</span>
                </Link>
                <div className="flex gap-4">
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
                <div className="w-full max-w-md bg-neutral-900/80 rounded-xl shadow-xl p-8 border border-neutral-800">
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
                                className="w-1/2 rounded-lg bg-neutral-950/70 border border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
                                required
                            />
                            <input
                                type="text"
                                name="lastName"
                                placeholder="Last name"
                                value={form.lastName}
                                onChange={handleChange}
                                className="w-1/2 rounded-lg bg-neutral-950/70 border border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
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
                            className="w-full rounded-lg bg-neutral-950/70 border border-neutral-700 px-3 py-2 outline-none focus:ring-2 focus:ring-violet-500"
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
                                className="w-full rounded-lg bg-neutral-950/70 border border-neutral-700 px-3 py-2 pr-14 outline-none focus:ring-2 focus:ring-violet-500"
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
                                className={`w-full rounded-lg bg-neutral-950/70 border px-3 py-2 pr-14 outline-none focus:ring-2 ${submitted && form.password !== form.confirmPassword
                                    ? "border-rose-500 ring-1 ring-rose-500"
                                    : "border-neutral-700 focus:ring-violet-500"
                                    }`}
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

                        {/* Submit */}
                        <button
                            type="submit"
                            className="w-full rounded-lg text-white font-semibold px-4 py-2 shadow transition bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 hover:brightness-110"
                        >
                            Sign Up
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

            <footer className="relative z-10 w-full bg-gray-900/80 backdrop-blur text-gray-300 py-6 mt-12 border-t border-neutral-800">
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
