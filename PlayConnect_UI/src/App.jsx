import { BrowserRouter, Routes, Route } from "react-router-dom"
import "./App.css"


import ProfileCreation from "./pages/ProfileCreation"


function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-900 text-neutral-100">
      <h1 className="text-4xl font-bold">Home Page</h1>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* homepage */}
        <Route path="/" element={<Home />} />

        {/* profile creation */}
        <Route path="/onboarding/profile" element={<ProfileCreation />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
