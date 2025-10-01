import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";

export default function HomePage() {
  const videoRef = useRef(null);
  const [revealBall, setRevealBall] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const goToGames = (e) => {
    if (e) e.preventDefault();
    const token = localStorage.getItem('authToken');
    if (isAuthenticated && token) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTimeUpdate = () => {
      if (vid.currentTime >= 1.5 && !revealBall) {
        setRevealBall(true);
      }
    };
    vid.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      vid.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [revealBall]);

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-neutral-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-2 text-2xl font-bold">
          <span>PlayConnect</span>
          <span>🏀🎾</span>
        </div>
        <div className="hidden md:flex gap-6 text-lg">
          <a href="/" className="hover:text-yellow-300 transition">Home</a>
          <a href="/coaches" className="hover:text-yellow-300 transition">Coaches</a>
          <a href="/games" onClick={goToGames} className="hover:text-yellow-300 transition">Games</a>
          <a href="/community" className="hover:text-yellow-300 transition">Community</a>
        </div>
        <div className="flex gap-4">
          <a href="/login" className="px-4 py-2 rounded-lg border border-black text-black bg-white hover:bg-neutral-900 hover:text-black transition">
            Login
          </a>
          <a href="/signup" className="px-4 py-2 rounded-lg border border-black text-black bg-white hover:bg-neutral-900 hover:text-black transition">
            Sign Up
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative w-full h-96 overflow-hidden">
        <video
          ref={videoRef}
          src="/serve.mp4"
          autoPlay
          muted
          loop={true}
          className="w-full h-full object-cover"
        />
        <h1 className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-white drop-shadow-lg">
          PlayC
          {revealBall ? (
            <span className="inline-block text-yellow-300 animate-pulse">🏀</span>
          ) : (
            "o"
          )}
          nnect
          {revealBall && (
            <motion.span
              initial={{ x: 100, y: -200, opacity: 0, rotate: -180 }}
              animate={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              transition={{ duration: 1.2, type: "spring", stiffness: 120 }}
              className="ml-2 inline-block"
            >
              🎾
            </motion.span>
          )}
        </h1>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto mt-16 px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="p-6 bg-white shadow rounded-lg text-center">
          <h3 className="text-xl font-semibold">🏅 Coaches</h3>
          <p className="mt-2 text-gray-600">Find certified coaches to train and guide you.</p>
        </div>
        <div className="p-6 bg-white shadow rounded-lg text-center">
          <h3 className="text-xl font-semibold">🎮 Games</h3>
          <p className="mt-2 text-gray-600">Join or host games in your favorite sports.</p>
        </div>
        <div className="p-6 bg-white shadow rounded-lg text-center">
          <h3 className="text-xl font-semibold">🤝 Community</h3>
          <p className="mt-2 text-gray-600">Connect with players who share your passion.</p>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center mt-16 px-4">
        <p className="text-gray-700 text-lg mb-6">
          Ready to start your journey with PlayConnect?
        </p>
        <div className="flex justify-center space-x-4">
          <button className="px-6 py-3 bg-blue-600 text-blue rounded-lg shadow hover:bg-blue-700 transition">
            Explore Coaches
          </button>
          <button onClick={goToGames} className="px-6 py-3 bg-green-600 text-blue rounded-lg shadow hover:bg-green-700 transition">
            View Games
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-gray-900 text-gray-300 py-6 mt-16">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-4">
          <p>&copy; 2025 PlayConnect. All rights reserved.</p>
          <div className="space-x-4">
            <a href="#" className="hover:text-white">About</a>
            <a href="#" className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
