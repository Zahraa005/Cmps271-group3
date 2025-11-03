import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./App.css"
import { useContext } from "react";
import { AuthContext } from "./contexts/AuthContext";

import ProfileCreation from "./pages/ProfileCreation"
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegistrationPage from "./pages/RegistrationPage"
import DashboardPage from "./pages/DashboardPage"
import FriendsPage from "./pages/FriendsPage";
import EmailVerificationPage from "./pages/EmailVerificationPage";
import ResetPassword from "./pages/ResetPassword";
import { AuthProvider } from "./contexts/AuthContext"
import CoachesListPage from "./pages/CoachesListPage";
import CoachProfilePage from "./pages/CoachProfilePage";
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import FAQPage from './pages/FAQPage';
//import ToastPortal from "./components/ToastPortal";
//import NotificationsPoller from "./components/NotificationsPoller";
//import NotificationBell from "./components/NotificationBell";




function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-100">
      <h1 className="text-4xl font-bold">Home Page</h1>
    </main>
  )
}

function App() {
  const { user } = useContext(AuthContext) || {};
  const userId =
    user?.user_id ?? user?.id ?? Number(localStorage.getItem("user_id") || 0);
  return (
    <AuthProvider>
      <BrowserRouter>
         {/* ADD: lightweight header with the bell */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: 12 }}>
          {userId ? <NotificationBell userId={userId} /> : null}
        </div>

        <Routes>
          {/* homepage */}
          <Route path="/" element={<HomePage />} />

          {/* login page */}
          <Route path="/login" element={<LoginPage />} />

          {/* registration */}
          <Route path="/signup" element={<RegistrationPage />} />

          {/* email verification */}
          <Route path="/verify-email" element={<EmailVerificationPage />} />

          {/* profile creation */}
          <Route path="/onboarding/profile" element={<ProfileCreation />} />

          {/* dashboard */}
          <Route path="/dashboard" element={<DashboardPage />} />
           {/* Friends Page route */}
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Coaches List Page route */}
          <Route path="/coaches" element={<CoachesListPage />} />

          {/* Coach Profile Page route */}
          <Route path="/coach/:coachId" element={<CoachProfilePage />} />

          {/* About Page route */}
          <Route path="/about" element={<AboutPage />} />

          {/* Contact Page route */}  
          <Route path="/contact" element={<ContactPage />} />
          
          {/* FAQ Page route */}
          <Route path="/faq" element={<FAQPage />} />
        </Routes>

        {/* ADD: mount once so pop-ups work app-wide */}
        <ToastPortal />
        {userId ? <NotificationsPoller userId={userId} /> : null}

      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
