import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import API_BASE_URL from '../Api/config';


const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper function to decode JWT token and check expiration
const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // JWT tokens have 3 parts separated by dots: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[Token Check] Invalid token format');
      return true;
    }
    
    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]));
    
    // Check if token has expiration claim
    if (!payload.exp) {
      console.log('[Token Check] Token has no expiration claim');
      return true;
    }
    
    // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();
    const timeUntilExpiry = expirationTime - currentTime;
    
    // Only log when expired or close to expiration (within 5 minutes) to reduce console noise
    if (timeUntilExpiry <= 300000 || currentTime >= expirationTime) {
      if (currentTime >= expirationTime) {
        console.log('[Token Check] Token is EXPIRED');
      } else {
        console.log(`[Token Check] Token expiring soon - ${Math.round(timeUntilExpiry / 60000)} minutes remaining`);
      }
    }
    
    // Check if expired (add small 5-second buffer to account for clock skew)
    const expired = currentTime >= expirationTime - 5000;
    
    return expired;
  } catch (error) {
    console.error('[Token Check] Error decoding token:', error);
    return true; // If we can't decode, consider it expired
  }
};

// Store original fetch
const originalFetch = window.fetch;

// Wrapper for fetch that automatically handles 401 responses and checks token before requests
const createAuthenticatedFetch = (logoutCallback) => {
  return async (...args) => {
    // Check token expiration before making request
    const token = localStorage.getItem('authToken');
    if (token && isTokenExpired(token)) {
      console.log('[Fetch] Token expired before API call - logging out');
      logoutCallback();
      // Return a rejected response to prevent the actual request
      throw new Error('Authentication token has expired');
    }
    
    const response = await originalFetch(...args);
    
    // Check for 401 Unauthorized responses
    if (response.status === 401) {
      console.log('[Fetch] Received 401 Unauthorized - token may be expired');
      logoutCallback();
    }
    
    return response;
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenCheckIntervalRef = useRef(null);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    localStorage.removeItem('user_id');
    
    // Clear token check interval
    if (tokenCheckIntervalRef.current) {
      clearInterval(tokenCheckIntervalRef.current);
      tokenCheckIntervalRef.current = null;
    }
  }, []);

  const checkTokenExpiration = useCallback(() => {
    const token = localStorage.getItem('authToken');
    
    if (token && isTokenExpired(token)) {
      console.log('JWT token has expired - logging out user');
      logout();
      
      // Redirect to login page if we're on a protected route
      if (window.location.pathname !== '/login' && window.location.pathname !== '/signup' && window.location.pathname !== '/') {
        window.location.href = '/login';
      }
    }
  }, [logout]);

  useEffect(() => {
    // Set up fetch interceptor for 401 responses and token checks
    const authenticatedFetch = createAuthenticatedFetch(logout);
    window.fetch = authenticatedFetch;
    
    // Check token when window regains focus (user comes back to tab)
    const handleFocus = () => {
      console.log('[Window Focus] Checking token expiration');
      checkTokenExpiration();
    };
    window.addEventListener('focus', handleFocus);
    
    // Check if user is logged in on app start
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    // First check if token is expired
    if (token && isTokenExpired(token)) {
      console.log('Stored token is expired - clearing authentication');
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('user_id');
      setLoading(false);
      
      // Return cleanup function even for early return
      return () => {
        window.fetch = originalFetch;
        window.removeEventListener('focus', handleFocus);
      };
    }
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        // Enrich with name fields if missing
        if (!parsedUser.first_name || !parsedUser.last_name) {
          (async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/users`);

              if (res.ok) {
                const users = await res.json();
                const match = users.find(u => u.user_id === parsedUser.user_id || u.email === parsedUser.email);
                if (match) {
                  const enriched = { ...parsedUser, first_name: match.first_name, last_name: match.last_name };
                  setUser(enriched);
                  localStorage.setItem('userData', JSON.stringify(enriched));
                }
              }
            } catch (e) {
              // Ignore enrichment failures
            }
          })();
        }

        // Set up periodic token expiration check (every 1 minute for 4-hour tokens)
        tokenCheckIntervalRef.current = setInterval(() => {
          checkTokenExpiration();
        }, 60000); // Check every 60 seconds (1 minute) for 4-hour token expiry
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    }
    
    setLoading(false);

    // Cleanup function
    return () => {
      if (tokenCheckIntervalRef.current) {
        clearInterval(tokenCheckIntervalRef.current);
      }
      // Restore original fetch
      window.fetch = originalFetch;
      // Remove focus event listener
      window.removeEventListener('focus', handleFocus);
    };
  }, [logout, checkTokenExpiration]);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          password: password
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let userData = {
          user_id: data.user_id,
          email: email,
          role: data.role,
          token: data.access_token
        };
        
        // Try to fetch names from users endpoint
        try {
          const res = await fetch(`${API_BASE_URL}/users`);

          if (res.ok) {
            const users = await res.json();
            const match = users.find(u => u.user_id === data.user_id || u.email === email);
            if (match) {
              userData = { ...userData, first_name: match.first_name, last_name: match.last_name };
            }
          }
        } catch (_) {
          // If enrichment fails, proceed without names
        }

        setUser(userData);
        localStorage.setItem('authToken', data.access_token);
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem("user_id", userData.user_id);

        // Set up periodic token expiration check after login
        if (tokenCheckIntervalRef.current) {
          clearInterval(tokenCheckIntervalRef.current);
        }
        tokenCheckIntervalRef.current = setInterval(() => {
          checkTokenExpiration();
        }, 60000); // Check every 60 seconds (1 minute) for 4-hour token expiry
        
        return { success: true };
      } else {
        const errorData = await response.json();
        // Check if it's an email verification error
        if (response.status === 403 && errorData.detail && errorData.detail.includes("verify your email")) {
          return { 
            success: false, 
            error: errorData.detail,
            needsVerification: true 
          };
        }
        return { success: false, error: errorData.detail || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };


  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
