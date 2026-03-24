"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { auth as authApi } from "./api";

interface UserProfile {
  role: string;
  user_id: number;
  school_id?: number;
}

interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  user: UserProfile | null;
  login: (password: string, email?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  loading: true,
  user: null,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("cd_token");
    if (token) {
      authApi
        .me()
        .then((data) => {
          setIsAuthenticated(true);
          setUser({ role: data.role, user_id: data.user_id, school_id: data.school_id });
        })
        .catch(() => {
          localStorage.removeItem("cd_token");
          setIsAuthenticated(false);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (password: string, email?: string) => {
    const res = await authApi.login(password, email);
    localStorage.setItem("cd_token", res.token);
    setIsAuthenticated(true);
    setUser({ role: res.role, user_id: 0, school_id: undefined });
  };

  const logout = () => {
    localStorage.removeItem("cd_token");
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
