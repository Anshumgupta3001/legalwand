import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);
const STORAGE_TOKEN = 'gstwand_token';
const STORAGE_USER = 'gstwand_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_TOKEN);
    const storedUser = localStorage.getItem(STORAGE_USER);

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (err) {
        localStorage.removeItem(STORAGE_TOKEN);
        localStorage.removeItem(STORAGE_USER);
      }
    }

    setInitialLoading(false);
  }, []);

  // NOTE: isAuthenticated is driven explicitly by login/clearAuth, not derived
  // from [token, user] deps — that caused a race where Effect 2 fired with
  // stale null values and overwrote the true set by the init effect, briefly
  // making RequireAuth think the user was logged out and redirect to /.

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_TOKEN);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_USER);
    }
  }, [user]);

  const updateUser = (updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  };

  const clearAuth = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
  };

  const register = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authAPI.register(data);
      const { token: accessToken, user: userData } = response.data;
      setToken(accessToken);
      setUser(userData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authAPI.login(data);
      const { token: accessToken, user: userData } = response.data;
      setToken(accessToken);
      setUser(userData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authAPI.forgotPassword(data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Request failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authAPI.verifyOTP(data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated,
      initialLoading,
      loading,
      error,
      register,
      login,
      logout,
      forgotPassword,
      verifyOTP,
      setError,
      updateUser,
    }),
    [user, token, isAuthenticated, initialLoading, loading, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
