import React from 'react';
import { Users, Target, Heart, Award } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
      {/* Background Effects */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
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

      {/* Navbar */}
      <nav className="relative z-10 flex justify-between items-center py-5 px-10 border-b border-neutral-800">
        <div className="flex items-center gap-2 text-2xl font-bold">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
            PlayConnect
          </span>
          <span>🏀🎾</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="/" className="text-neutral-300 hover:text-white text-sm transition">
            Home
          </a>
          <a href="/dashboard" className="text-neutral-300 hover:text-white text-sm transition">
            Dashboard
          </a>
          <a href="/friends" className="text-neutral-300 hover:text-white text-sm transition">
            Community
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 text-center pt-20 pb-16 px-6">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
            About PlayConnect
          </span>
        </h1>
        <p className="text-xl text-neutral-400 max-w-3xl mx-auto leading-relaxed">
          PlayConnect is a community-driven sports platform designed to bring athletes, sports lovers, 
          and coaches together. Whether you're looking to join a match, book a coach, or simply meet new players, 
          PlayConnect makes it easy to connect through sports.
        </p>
      </div>

      {/* Mission Section */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 rounded-2xl p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-fuchsia-400" size={32} />
            <h2 className="text-3xl font-bold text-white">Our Mission</h2>
          </div>
          <div className="space-y-4 text-neutral-300 text-lg leading-relaxed">
            <p>
              Our mission is to promote an active lifestyle, foster real friendships, and help everyone 
              discover the joy of staying fit — together.
            </p>
            <p>
              From basketball and tennis to football and padel — we aim to build the most vibrant and welcoming sports 
              community across schools, universities, and cities.
            </p>
          </div>
        </div>
      </div>

      {/* Values Grid */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-4xl font-bold text-center mb-12 text-white">What We Stand For</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Community */}
          <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 border border-indigo-700/50 rounded-xl p-8 hover:scale-105 transition-transform duration-300">
            <Users className="text-indigo-400 mb-4" size={40} />
            <h3 className="text-2xl font-bold text-white mb-3">Community First</h3>
            <p className="text-neutral-300">
              Building lasting connections and friendships through shared passion for sports and fitness.
            </p>
          </div>

          {/* Accessibility */}
          <div className="bg-gradient-to-br from-fuchsia-900/50 to-fuchsia-800/30 border border-fuchsia-700/50 rounded-xl p-8 hover:scale-105 transition-transform duration-300">
            <Heart className="text-fuchsia-400 mb-4" size={40} />
            <h3 className="text-2xl font-bold text-white mb-3">For Everyone</h3>
            <p className="text-neutral-300">
              Whether you're a beginner or pro, PlayConnect welcomes all skill levels and backgrounds.
            </p>
          </div>

          {/* Excellence */}
          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/50 rounded-xl p-8 hover:scale-105 transition-transform duration-300">
            <Award className="text-purple-400 mb-4" size={40} />
            <h3 className="text-2xl font-bold text-white mb-3">Growth & Excellence</h3>
            <p className="text-neutral-300">
              Supporting athletes in their journey to improve, with access to certified coaches and training.
            </p>
          </div>
        </div>
      </div>

      {/* Project Context */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        <div className="bg-neutral-900/70 border border-neutral-700 rounded-xl p-8 text-center">
          <p className="text-neutral-300 text-lg leading-relaxed">
            PlayConnect started as a university project with a simple goal: to solve the common problem 
            of finding people to play sports with. What began as a course assignment has evolved into 
            a platform with real potential to impact communities and help people stay active together.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 text-center py-20 px-6">
        <h2 className="text-4xl font-bold text-white mb-6">Join Our Community</h2>
        <p className="text-neutral-400 text-lg mb-8 max-w-2xl mx-auto">
          Be part of something bigger. Connect with players, find games, and make sports more accessible for everyone.
        </p>
        <a
          href="/signup"
          className="inline-block px-8 py-4 bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-fuchsia-600 transition-all duration-300 shadow-lg hover:shadow-fuchsia-500/50"
        >
          Get Started Today
        </a>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-800 py-8 text-center text-neutral-500 text-sm">
        <p>&copy; 2025 PlayConnect. All rights reserved.</p>
      </footer>
    </div>
  );
}