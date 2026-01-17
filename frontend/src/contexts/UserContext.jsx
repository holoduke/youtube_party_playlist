import { createContext, useContext, useState, useEffect } from 'react';
import { getUsers } from '../services/api';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await getUsers();
        setUsers(data);

        // Check localStorage for saved user
        const savedUserId = localStorage.getItem('barmania_user_id');
        if (savedUserId) {
          const user = data.find(u => u.id === parseInt(savedUserId));
          if (user) setCurrentUser(user);
        }
      } catch (error) {
        console.error('Failed to load users:', error);
      }
      setLoading(false);
    };

    loadUsers();
  }, []);

  const selectUser = (user) => {
    setCurrentUser(user);
    localStorage.setItem('barmania_user_id', user.id.toString());
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('barmania_user_id');
  };

  return (
    <UserContext.Provider value={{ users, currentUser, selectUser, logout, loading }}>
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
