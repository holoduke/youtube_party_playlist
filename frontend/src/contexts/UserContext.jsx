import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin, register as apiRegister } from '../services/api';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check URL for OAuth callback data
    const params = new URLSearchParams(window.location.search);
    const oauthUser = params.get('oauth_user');
    const oauthError = params.get('error');

    if (oauthUser) {
      try {
        const user = JSON.parse(atob(oauthUser));
        setCurrentUser(user);
        localStorage.setItem('barmania_user', JSON.stringify(user));
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {
        console.error('Failed to parse OAuth user data', e);
      }
      setLoading(false);
      return;
    }

    if (oauthError) {
      console.error('OAuth error:', oauthError);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Check localStorage for saved user session
    const savedUser = localStorage.getItem('barmania_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
      } catch {
        localStorage.removeItem('barmania_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    const response = await apiLogin(username, password);
    const user = response.user;
    setCurrentUser(user);
    localStorage.setItem('barmania_user', JSON.stringify(user));
    return user;
  };

  const register = async (username, email, password, passwordConfirmation) => {
    const response = await apiRegister(username, email, password, passwordConfirmation);
    const user = response.user;
    setCurrentUser(user);
    localStorage.setItem('barmania_user', JSON.stringify(user));
    return user;
  };

  const loginWithGoogle = () => {
    // Store current URL to return to after OAuth
    const returnUrl = window.location.origin + window.location.pathname;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    window.location.href = `${apiUrl}/api/auth/google/redirect?return_url=${encodeURIComponent(returnUrl)}`;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('barmania_user');
  };

  const updateUser = (updates) => {
    const updatedUser = { ...currentUser, ...updates };
    setCurrentUser(updatedUser);
    localStorage.setItem('barmania_user', JSON.stringify(updatedUser));
  };

  return (
    <UserContext.Provider value={{
      currentUser,
      login,
      register,
      loginWithGoogle,
      logout,
      loading,
      updateUser,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
