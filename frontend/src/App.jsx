import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import TrashView from './pages/TrashView';
import SharedDocumentView from './pages/SharedDocumentView';
import Favorites from './pages/Favorites';
import Profile from './pages/Profile';

function App() {
  // Small comment to trigger new Netlify build
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Register />} />
              <Route path="/shared/:shareToken" element={<SharedDocumentView />} />

              {/* Protected User Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* Admin Impersonation Route */}
              <Route
                path="/admin/view-user/:userId"
                element={
                  <ProtectedRoute adminOnly>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* Trash Route */}
              <Route
                path="/trash"
                element={
                  <ProtectedRoute>
                    <TrashView />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/favorites"
                element={
                  <ProtectedRoute>
                    <Favorites />
                  </ProtectedRoute>
                }
              />

              {/* Profile Route */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly={true}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
          <footer className="py-4 text-center">
            <p className="text-[10px] text-slate-500/60 font-medium tracking-wide">
              Developed By Rishabh
            </p>
          </footer>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
