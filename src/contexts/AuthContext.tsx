import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import bcrypt from 'bcryptjs';

interface User {
  id: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'onekey_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      try {
        const userData = JSON.parse(session);
        setUser(userData);
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      
      // Query the users table
      const { data: users, error } = await supabase
        .from('users')
        .select('id, username, password_hash')
        .eq('username', username)
        .limit(1);

      if (error) {
        console.error('Login query error:', error);
        return { success: false, error: 'Terjadi kesalahan saat login' };
      }

      if (!users || users.length === 0) {
        return { success: false, error: 'Username tidak ditemukan' };
      }

      const dbUser = users[0];
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, dbUser.password_hash);
      
      if (!isValidPassword) {
        return { success: false, error: 'Password salah' };
      }

      // Set user session
      const userData: User = {
        id: dbUser.id,
        username: dbUser.username,
      };

      setUser(userData);
      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      
      return { success: true };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Terjadi kesalahan saat login' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
