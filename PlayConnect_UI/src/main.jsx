import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { applyTheme } from './theme/useTheme'
import { AuthProvider } from "./contexts/AuthContext";

// Apply saved theme before React mounts to avoid FOUC
try {
  const saved = localStorage.getItem('theme') || 'system'
  applyTheme(saved)
} catch {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
