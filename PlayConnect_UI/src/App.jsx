import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./App.css"

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



function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-100">
      <h1 className="text-4xl font-bold">Home Page</h1>
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
