import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FolderOpen, LogOut, ShieldAlert, User } from 'lucide-react';

const getRoleDisplay = (role) => {
  switch (role) {
    case 'superadmin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'user':
      return 'User';
    default:
      return role;
  }
};

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (showLogoutModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showLogoutModal]);

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <>
      <nav className="glass-panel sticky top-0 z-50 border-b border-white/10 px-6 py-4 shadow-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <FolderOpen className="h-7 w-7 text-sky-500" />
            <span className="text-xl font-bold tracking-wider text-white">DMS</span>
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
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Favorites
            </Link>
            
            {(user.role === 'admin' || user.role === 'superadmin') && (
              <Link
                to="/admin"
                className="flex items-center space-x-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Admin Panel</span>
              </Link>
            )}

            {/* User Info Pill — links to Profile page */}
            <Link
              to="/profile"
              className="flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full text-sm hover:bg-white/10 transition-colors"
            >
              {/* Profile Photo Avatar */}
              <div className="h-6 w-6 rounded-full overflow-hidden border border-sky-500/40 flex-shrink-0">
                {user.profilePhoto?.url ? (
                  <img
                    src={user.profilePhoto.url}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-sky-500/30 to-purple-500/30 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-sky-400" />
                  </div>
                )}
              </div>
              <span className="font-semibold text-slate-200">{user.name}</span>
              <span className="text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 uppercase">
                {getRoleDisplay(user.role)}
              </span>
            </Link>

            {/* Logout */}
            <button
              onClick={() => setShowLogoutModal(true)}
              className="flex items-center space-x-2 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all border border-rose-500/10 hover:border-rose-500/30 px-4 py-2 rounded-full"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Logout Confirmation Modal (Instagram Style) */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-[340px] rounded-[16px] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center flex flex-col items-center">
              <h3 className="text-[17px] font-semibold text-black leading-tight mb-2">
                Log out of<br />{user.name}?
              </h3>
              <p className="text-[13px] text-gray-500 leading-snug px-2">
                Any drafts you've saved will still be available on this device.
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full py-3.5 border-t border-gray-200 text-[14px] font-bold text-[#0095f6] hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Log out
            </button>
            
            <button
              onClick={() => setShowLogoutModal(false)}
              className="w-full py-3.5 border-t border-gray-200 text-[14px] font-normal text-black hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
