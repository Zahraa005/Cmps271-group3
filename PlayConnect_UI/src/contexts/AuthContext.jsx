import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        // Enrich with name fields if missing
        if (!parsedUser.first_name || !parsedUser.last_name) {
          (async () => {
            try {
              const res = await fetch('http://127.0.0.1:8000/users');
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
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      }
    }
    
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/login', {
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
          const res = await fetch('http://127.0.0.1:8000/users');
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
        
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.detail || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
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
