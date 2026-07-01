import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

// Set API base URL
const API_URL = import.meta.env.VITE_API_URL;
console.log('🔧 Full environment variables available:', import.meta.env);
console.log('🔧 API_URL from env:', API_URL);

if (API_URL) {
  axios.defaults.baseURL = API_URL;
  console.log('✅ Axios baseURL set to:', axios.defaults.baseURL);
} else {
  console.error('❌ NO VITE_API_URL FOUND! Requests will fail!');
}

// Add an axios interceptor to log every request
axios.interceptors.request.use(
  (config) => {
    console.log('🚀 Sending request to:', config.baseURL + config.url);
    console.log('Request config:', config);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add an interceptor for responses too
axios.interceptors.response.use(
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
          axios.defaults.headers.common[
            'Authorization'
          ] = `Bearer ${token}`;

          const res = await axios.get('/api/auth/me');
          setUser(res.data);
        }
      } catch (err) {
        console.error('Session expired or invalid token', err);

        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkLoggedIn();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await axios.post('/api/auth/login', {
        email,
        password,
      });

      const { token, ...userData } = res.data;

      localStorage.setItem('token', token);
      axios.defaults.headers.common[
        'Authorization'
      ] = `Bearer ${token}`;

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
      const res = await axios.post(
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

      axios.defaults.headers.common[
        'Authorization'
      ] = `Bearer ${token}`;

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
    delete axios.defaults.headers.common['Authorization'];
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