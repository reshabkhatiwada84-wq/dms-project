import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FolderOpen, LogOut, ShieldAlert, User, Star } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="glass-panel sticky top-0 z-50 border-b border-white/10 px-6 py-4 shadow-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 text-sky-400 hover:text-sky-300 transition-colors">
          <FolderOpen className="h-8 w-8" />
          <span className="text-xl font-bold tracking-wider text-white">DMS by Rishabh</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center space-x-6">
          <Link
            to="/"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Dashboard
          </Link>

          <Link
            to="/favorites"
            className="flex items-center space-x-1.5 text-sm font-medium text-slate-300 hover:text-amber-400 transition-colors"
          >
            <Star className="h-4 w-4" />
            <span>Favorites</span>
          </Link>
          
          {user.role === 'admin' && (
            <Link
              to="/admin"
              className="flex items-center space-x-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Admin Panel</span>
            </Link>
          )}

          {/* User Info Pill */}
          <div className="flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm">
            <User className="h-4 w-4 text-sky-400" />
            <span className="font-semibold text-slate-200">{user.name}</span>
            <span className="text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 uppercase">
              {user.email === 'rishabh@gmail.com' ? 'Super Admin' : user.role}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all border border-rose-500/10 hover:border-rose-500/30 px-4 py-2 rounded-full"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
