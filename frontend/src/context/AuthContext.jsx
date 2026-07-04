import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

// Set API base URL with extremely strict fallbacks
export let API_URL = import.meta.env.VITE_API_URL;

// If the variable is missing or invalid (like a single slash "/"), force the correct URL
if (!API_URL || !API_URL.startsWith('http')) {
  API_URL = import.meta.env.DEV ? 'http://localhost:5000' : 'https://dms-project-tzvd.onrender.com';
}
console.log('🔧 API_URL from env or fallback:', API_URL);

// Use a dedicated axios instance with an explicit baseURL.
// This prevents accidental requests to the Netlify origin like `/api/...` relative calls.
export const api = axios.create({ baseURL: API_URL });

// Add an axios interceptor to log every request
api.interceptors.request.use(
  (config) => {
    console.log('🚀 Sending request to:', config.baseURL + config.url);
    console.log('Request config:', config);
    return config;
  },
  (error) => Promise.reject(error)
);

// Add an interceptor for responses too
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response received:', response);
    return response;
  },
  (error) => {
    console.error('❌ Request failed:', error);
    console.error('Error response:', error.response);
    console.error('Error config:', error.config);
    return Promise.reject(error);
  }
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkLoggedIn = async () => {
      try {
        const token = localStorage.getItem('token');

        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          const res = await api.get('/api/auth/me');
          setUser(res.data);
        }
      } catch (err) {
        console.error('Session expired or invalid token', err);

        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);

      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/api/auth/login', {
        email,
        password,
      });


      const { token, ...userData } = res.data;

      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setUser(userData);

      return {
        success: true,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err?.response?.data?.message ||
          'Invalid credentials',
      };
    }
  };

  const register = async (
    name,
    email,
    password,
    role
  ) => {
    try {
      const res = await api.post(
        '/api/auth/register',
        {
          name,
          email,
          password,
          role,
        }
      );

      const { token, ...userData } = res.data;

      localStorage.setItem('token', token);

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      setUser(userData);

      return {
        success: true,
      };
    } catch (err) {
      return {
        success: false,
        message:
          err?.response?.data?.message ||
          'Registration failed',
      };
    }
  };

const logout = () => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};