import React, { useState, useContext, useRef } from 'react';
import { AuthContext, api } from '../context/AuthContext';
import { Camera, Trash2, Upload, X, User, Mail, Shield, Clock } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useContext(AuthContext);
  const [uploading, setUploading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error');
      return;
    }

    setUploading(true);
    setShowMenu(false);

    try {
      const formData = new FormData();
      formData.append('profilePhoto', file);

      const res = await api.put('/api/auth/profile-photo', formData);

      updateUser({ profilePhoto: res.data.profilePhoto });
      showToast('Profile photo updated successfully');
    } catch (error) {
      showToast(error?.response?.data?.message || 'Failed to upload photo', 'error');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    setShowMenu(false);
    setUploading(true);

    try {
      await api.delete('/api/auth/profile-photo');
      updateUser({ profilePhoto: { url: null, publicId: null } });
      showToast('Profile photo removed');
    } catch (error) {
      showToast(error?.response?.data?.message || 'Failed to remove photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = () => {
    setShowMenu(false);
    fileInputRef.current?.click();
  };

  const hasPhoto = user?.profilePhoto?.url;

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[100] flex items-center space-x-3 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-xl transition-all animate-slide-in ${
            toast.type === 'error'
              ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/10 p-8 w-full max-w-md shadow-2xl">
        {/* Profile Photo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            {/* Avatar */}
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-sky-500/30 shadow-lg shadow-sky-500/10">
              {hasPhoto ? (
                <img
                  src={user.profilePhoto.url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-sky-500/20 to-purple-500/20 flex items-center justify-center">
                  <User className="h-14 w-14 text-slate-400" />
                </div>
              )}

              {/* Loading overlay */}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full">
                  <div className="w-8 h-8 border-3 border-sky-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Camera Button */}
            <button
              onClick={() => setShowMenu(!showMenu)}
              disabled={uploading}
              className="absolute bottom-1 right-1 w-9 h-9 bg-sky-500 hover:bg-sky-400 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-slate-900 transition-all hover:scale-110 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div
                ref={menuRef}
                className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <button
                  onClick={triggerFileInput}
                  className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-slate-200 hover:bg-white/10 transition-colors"
                >
                  <Upload className="h-4 w-4 text-sky-400" />
                  <span>{hasPhoto ? 'Change Photo' : 'Upload Photo'}</span>
                </button>
                {hasPhoto && (
                  <button
                    onClick={handleRemovePhoto}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors border-t border-white/5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Remove Photo</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />

          <h2 className="mt-5 text-xl font-bold text-white">{user.name}</h2>
          <p className="text-sm text-slate-400 mt-1">{user.email}</p>
        </div>

        {/* User Info Cards */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <User className="h-5 w-5 text-sky-400" />
            <div>
              <p className="text-xs text-slate-400">Full Name</p>
              <p className="text-sm font-medium text-slate-200">{user.name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <Mail className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-xs text-slate-400">Email Address</p>
              <p className="text-sm font-medium text-slate-200">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <Shield className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-xs text-slate-400">Role</p>
              <p className="text-sm font-medium text-slate-200 capitalize">
                {user.email === 'khd.rishabh@gmail.com' ? 'Super Admin' : user.role}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <Clock className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-xs text-slate-400">Member Since</p>
              <p className="text-sm font-medium text-slate-200">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Close menu when clicking outside */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default Profile;
