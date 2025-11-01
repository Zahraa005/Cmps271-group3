import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Users, Calendar, Shield, Trophy } from 'lucide-react';

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqCategories = [
    {
      icon: <HelpCircle className="text-indigo-400" size={24} />,
      title: "Getting Started",
      questions: [
        {
          q: "What is PlayConnect?",
          a: "PlayConnect is a community-driven sports platform that connects athletes, sports enthusiasts, and coaches. You can find games to join, book coaching sessions, meet new players, and build a sports community."
        },
        {
          q: "How do I sign up?",
          a: "Click the 'Sign Up' button in the navigation bar, fill in your details including your name, email, favorite sport, and create a password. Once registered, you can immediately start exploring games and connecting with players."
        },
        {
          q: "Is PlayConnect free to use?",
          a: "Yes! Creating an account and browsing games is completely free. Some premium features like advanced coaching sessions may have associated costs, but core features are always free."
        }
      ]
    },
    {
      icon: <Calendar className="text-fuchsia-400" size={24} />,
      title: "Games & Events",
      questions: [
        {
          q: "How do I find games near me?",
          a: "Navigate to the Games/Dashboard section after logging in. You can filter games by sport type, location, skill level, and date. The platform shows you games happening in your area with all the details you need."
        },
        {
          q: "Can I create my own game?",
          a: "Absolutely! Once logged in, go to the Dashboard and click 'Create Game'. Fill in the details like sport, location, date, time, and skill level. Other players can then find and join your game."
        },
        {
          q: "What if I need to cancel a game?",
          a: "If you're the game creator, you can edit or delete the game from your Dashboard. If you're a participant, you can leave the game. We recommend notifying other players if you need to cancel."
        },
        {
          q: "What sports are available?",
          a: "We support basketball, tennis, football (soccer), padel, volleyball, and many more. The platform is constantly expanding to include more sports based on community demand."
        }
      ]
    },
    {
      icon: <Users className="text-purple-400" size={24} />,
      title: "Community & Friends",
      questions: [
        {
          q: "How does the friend system work?",
          a: "You can send friend requests to other players you meet or discover. Once they accept, they'll appear in your Friends list. You can view their profiles, see mutual friends, and easily invite them to games."
        },
        {
          q: "Can I see who's playing in a game before joining?",
          a: "Yes! Each game listing shows the players who have joined. You can click on their profiles to see their favorite sports and activity history."
        },
        {
          q: "How do I find players with similar skill levels?",
          a: "Games are tagged with skill levels (beginner, intermediate, advanced). You can filter by skill level when browsing, ensuring you find games that match your abilities."
        }
      ]
    },
    {
      icon: <Trophy className="text-yellow-400" size={24} />,
      title: "Coaches",
      questions: [
        {
          q: "How do I find a coach?",
          a: "Visit the Coaches section to browse certified coaches. You can filter by sport, location, experience level, and hourly rate. Each coach has a detailed profile with reviews and availability."
        },
        {
          q: "How do I book a coaching session?",
          a: "Once you find a coach you like, click 'Book Session' on their profile. Select your preferred date and time, and confirm the booking. The coach will receive your request and confirm the session."
        },
        {
          q: "Are the coaches certified?",
          a: "Yes, all coaches on PlayConnect go through a verification process. We ensure they have proper certifications, experience, and good standing in the sports community."
        }
      ]
    },
    {
      icon: <Shield className="text-green-400" size={24} />,
      title: "Safety & Privacy",
      questions: [
        {
          q: "Is my personal information safe?",
          a: "Yes, we take privacy seriously. Your personal information is encrypted and never shared with third parties without your consent. You control what information is visible on your public profile."
        },
        {
          q: "What should I do if I encounter inappropriate behavior?",
          a: "Please report any concerning behavior through the 'Report' button on user profiles or game pages. Our team reviews all reports promptly and takes appropriate action."
        },
        {
          q: "Can I block other users?",
          a: "Yes, you can block users from your profile settings. Blocked users won't be able to see your games, send you friend requests, or contact you through the platform."
        }
      ]
    }
  ];

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
          <a href="/contact" className="text-neutral-300 hover:text-white text-sm transition">
            Contact
          </a>
        </div>
      </nav>

      <div className="relative z-10 text-center pt-20 pb-12 px-6">
        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-500 to-purple-500 bg-clip-text text-transparent">
            Frequently Asked Questions
          </span>
        </h1>
        <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
          Find answers to common questions about PlayConnect. Can't find what you're looking for? Contact us!
        </p>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 space-y-8">
        {faqCategories.map((category, catIndex) => (
          <div key={catIndex} className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              {category.icon}
              <h2 className="text-2xl font-bold text-white">{category.title}</h2>
            </div>

            <div className="space-y-3">
              {category.questions.map((item, qIndex) => {
                const globalIndex = `${catIndex}-${qIndex}`;
                const isOpen = openIndex === globalIndex;

                return (
                  <div
                    key={qIndex}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden transition-all duration-300"
                  >
                    <button
                      onClick={() => toggleFAQ(globalIndex)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-neutral-700/30 transition-colors"
                    >
                      <span className="font-semibold text-neutral-200 pr-4">{item.q}</span>
                      <ChevronDown
                        size={20}
                        className={`text-neutral-400 flex-shrink-0 transition-transform duration-300 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        isOpen ? 'max-h-96' : 'max-h-0'
                      }`}
                    >
                      <div className="p-4 pt-0 text-neutral-300 leading-relaxed">
                        {item.a}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-3">Still have questions?</h3>
          <p className="text-neutral-300 mb-6">
            We're here to help! Reach out to our support team and we'll get back to you as soon as possible.
          </p>
          <a
            href="/contact"
            className="inline-block px-8 py-3 bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold rounded-lg hover:from-indigo-600 hover:to-fuchsia-600 transition-all duration-300 shadow-lg hover:shadow-fuchsia-500/50"
          >
            Contact Support
          </a>
        </div>
      </div>

      <footer className="relative z-10 border-t border-neutral-800 py-8 mt-12 text-center text-neutral-500 text-sm">
        <p>&copy; 2025 PlayConnect. All rights reserved.</p>
      </footer>
    </div>
  );
}