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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
