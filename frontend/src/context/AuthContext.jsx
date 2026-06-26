import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

// Backend Base URL is now handled by Vite Proxy in development

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

    delete axios.defaults.headers.common[
      'Authorization'
    ];

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};