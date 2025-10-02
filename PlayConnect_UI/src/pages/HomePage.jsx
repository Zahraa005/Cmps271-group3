import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

export default function HomePage() {
  const videoRef = useRef(null);
  const [revealBall, setRevealBall] = useState(false);

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

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="bg-gradient-to-br from-rose-50 via-amber-50 to-emerald-50 min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-neutral-900 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2 text-2xl font-bold">
          <span>PlayConnect</span>
          <span>🏀🎾</span>
        </div>
        <div className="hidden md:flex gap-6 text-lg">
          <a href="/" className="hover:text-indigo-400 transition-colors duration-300">Home</a>
          <a href="/coaches" className="hover:text-indigo-400 transition-colors duration-300">Coaches</a>
          <a href="/games" className="hover:text-indigo-400 transition-colors duration-300">Games</a>
          <a href="/community" className="hover:text-indigo-400 transition-colors duration-300">Community</a>
        </div>
        <div className="flex gap-4">
          <a href="/login" className="px-5 py-2 rounded-lg border-2 border-white text-white hover:bg-white hover:text-neutral-900 transition-all duration-300">
            Login
          </a>
          <a href="/signup" className="px-5 py-2 rounded-lg border-2 border-white text-white hover:bg-white hover:text-neutral-900 transition-all duration-300">
            Sign Up
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative w-full h-[500px] overflow-hidden">
        <video
          ref={videoRef}
          src="/serve.mp4"
          autoPlay
          muted
          loop={true}
          className="w-full h-full object-cover brightness-75"
        />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <h1 className="text-7xl font-extrabold drop-shadow-2xl mb-4">
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
          <p className="text-2xl mb-8 text-gray-100 font-light drop-shadow-lg">Connect. Play. Compete.</p>
          <div className="flex gap-4">
            <a href="/games" className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg font-semibold text-lg hover:bg-white/10 hover:-translate-y-1 transition-all duration-300">
              Find Your Game
            </a>
            <a href="/signup" className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg font-semibold text-lg hover:bg-white/10 hover:-translate-y-1 transition-all duration-300">
              Get Started
            </a>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <motion.div 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        variants={fadeInUp}
        className="bg-white py-12 shadow-lg"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 px-4 text-center">
          <div>
            <div className="text-5xl font-bold text-indigo-600">500+</div>
            <div className="text-gray-600 text-lg mt-2">Active Games</div>
          </div>
          <div>
            <div className="text-5xl font-bold text-indigo-600">1,000+</div>
            <div className="text-gray-600 text-lg mt-2">Players Connected</div>
          </div>
          <div>
            <div className="text-5xl font-bold text-indigo-600">50+</div>
            <div className="text-gray-600 text-lg mt-2">Certified Coaches</div>
          </div>
        </div>
      </motion.div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto mt-20 px-4">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          variants={fadeInUp}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">What You Can Do</h2>
          <p className="text-xl text-gray-600">Everything you need to play, connect, and improve</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            variants={fadeInUp}
            whileHover={{ y: -10, transition: { duration: 0.3 } }}
            className="p-8 bg-gradient-to-br from-teal-400 to-blue-500 shadow-xl rounded-2xl text-white group cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <h3 className="text-5xl mb-4">🏆</h3>
              <h3 className="text-2xl font-bold mb-3">Coaches</h3>
              <p className="text-base leading-relaxed">Find certified coaches to train and guide you. Level up your skills with personalized training.</p>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            variants={fadeInUp}
            whileHover={{ y: -10, transition: { duration: 0.3 } }}
            className="p-8 bg-gradient-to-br from-purple-500 to-pink-500 shadow-xl rounded-2xl text-white group cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <h3 className="text-5xl mb-4">🎮</h3>
              <h3 className="text-2xl font-bold mb-3">Games</h3>
              <p className="text-base leading-relaxed">Create, join, edit, or delete game instances. Find pickup games in your area anytime.</p>
            </div>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            variants={fadeInUp}
            whileHover={{ y: -10, transition: { duration: 0.3 } }}
            className="p-8 bg-gradient-to-br from-orange-400 to-red-500 shadow-xl rounded-2xl text-white group cursor-pointer relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative z-10">
              <h3 className="text-5xl mb-4">🤝</h3>
              <h3 className="text-2xl font-bold mb-3">Community</h3>
              <p className="text-base leading-relaxed">Connect with players who share your passion. Build lasting friendships through sports.</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* How It Works Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        variants={fadeInUp}
        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white mt-20 py-16"
      >
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-6xl mb-4">1️⃣</div>
              <h3 className="text-xl font-bold mb-2">Sign Up</h3>
              <p className="text-gray-100">Create your player profile in minutes</p>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">2️⃣</div>
              <h3 className="text-xl font-bold mb-2">Find Games</h3>
              <p className="text-gray-100">Browse or create game instances near you</p>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">3️⃣</div>
              <h3 className="text-xl font-bold mb-2">Connect</h3>
              <p className="text-gray-100">Meet players and join the community</p>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-4">4️⃣</div>
              <h3 className="text-xl font-bold mb-2">Play!</h3>
              <p className="text-gray-100">Show up and have a great time</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* CTA Section */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        variants={fadeInUp}
        className="text-center mt-20 px-4 mb-20"
      >
        <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to Play?</h2>
        <p className="text-gray-700 text-xl mb-8">
          Join thousands of players already on PlayConnect
        </p>
      </motion.div>

      {/* Footer */}
      <footer className="w-full bg-gray-900 text-gray-300 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-3">PlayConnect</h3>
              <p className="text-gray-400">Connecting athletes and building communities through sports.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Quick Links</h3>
              <div className="space-y-2">
                <a href="/about" className="block hover:text-white transition-colors">About Us</a>
                <a href="/contact" className="block hover:text-white transition-colors">Contact</a>
                <a href="/faq" className="block hover:text-white transition-colors">FAQ</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-6 text-center">
            <p>&copy; 2025 PlayConnect. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}