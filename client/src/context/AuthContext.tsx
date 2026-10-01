import React, { createContext, useContext, useState, useEffect } from 'react';

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN' | 'SECURITY';

export interface User {
  id: string;
  username: string;
  role: Role;
  status: 'PENDING_VERIFY' | 'ACTIVE' | 'SUSPENDED';
  collegeEmail: string;
  department?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('cv_token', newToken);
    localStorage.setItem('cv_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('cv_token');
    localStorage.removeItem('cv_user');
  };

  const refreshUser = async () => {
    const savedToken = localStorage.getItem('cv_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setToken(savedToken);
      } else {
        logout();
      }
    } catch {
      // Offline fallback: keep cached user if valid
      const cached = localStorage.getItem('cv_user');
      if (cached) {
        setUser(JSON.parse(cached));
        setToken(savedToken);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
