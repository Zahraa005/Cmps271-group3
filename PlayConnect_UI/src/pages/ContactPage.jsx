import React, { useState } from 'react';
import { Mail, MessageSquare, Send, MapPin, Phone } from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
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
          <a href="/about" className="text-neutral-300 hover:text-white text-sm transition">
            About
          </a>
          <a href="/faq" className="text-neutral-300 hover:text-white text-sm transition">
            FAQ
          </a>
        </div>
      </nav>

      <div className="relative z-10 text-center pt-20 pb-12 px-6">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
            Get In Touch
          </span>
        </h1>
        <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
          Have questions or feedback? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
        </p>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-10">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-700 rounded-2xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <MessageSquare className="text-fuchsia-400" size={28} />
              <h2 className="text-2xl font-bold text-white">Send us a Message</h2>
            </div>

            {submitted ? (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 text-center">
                <div className="text-green-400 text-5xl mb-3">✓</div>
                <p className="text-green-300 text-lg font-semibold">Message Sent!</p>
                <p className="text-neutral-400 mt-2">We'll get back to you soon.</p>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-neutral-300 mb-2 font-medium">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 mb-2 font-medium">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 mb-2 font-medium">Subject</label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition"
                    placeholder="What's this about?"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 mb-2 font-medium">Message</label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows="5"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition resize-none"
                    placeholder="Tell us more..."
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  className="w-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold py-3 rounded-lg hover:from-indigo-600 hover:to-fuchsia-600 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-fuchsia-500/50"
                >
                  <Send size={18} />
                  Send Message
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 border border-indigo-700/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="bg-indigo-500/20 p-3 rounded-lg">
                  <Mail className="text-indigo-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Email Us</h3>
                  <p className="text-neutral-300">support@playconnect.com</p>
                  <p className="text-neutral-400 text-sm mt-1">We'll respond within 24 hours</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-fuchsia-900/50 to-fuchsia-800/30 border border-fuchsia-700/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="bg-fuchsia-500/20 p-3 rounded-lg">
                  <MapPin className="text-fuchsia-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Location</h3>
                  <p className="text-neutral-300">Beirut, Lebanon</p>
                  <p className="text-neutral-400 text-sm mt-1">Serving communities worldwide</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 border border-purple-700/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="bg-purple-500/20 p-3 rounded-lg">
                  <Phone className="text-purple-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Need Help?</h3>
                  <p className="text-neutral-300">Check our FAQ page</p>
                  <a href="/faq" className="text-purple-400 hover:text-purple-300 text-sm mt-1 inline-block">
                    Visit FAQ →
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900/70 border border-neutral-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-3">Office Hours</h3>
              <div className="space-y-2 text-neutral-300 text-sm">
                <div className="flex justify-between">
                  <span>Monday - Friday:</span>
                  <span className="font-semibold">9:00 AM - 6:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Saturday:</span>
                  <span className="font-semibold">10:00 AM - 4:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Sunday:</span>
                  <span className="font-semibold">Closed</span>
                </div>
              </div>
              <p className="text-neutral-400 text-xs mt-4">* Times shown in local timezone (EET)</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 border-t border-neutral-800 py-8 mt-20 text-center text-neutral-500 text-sm">
        <p>&copy; 2025 PlayConnect. All rights reserved.</p>
      </footer>
    </div>
  );
}