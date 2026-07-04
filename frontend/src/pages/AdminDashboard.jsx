import React, { useState, useEffect, useContext } from 'react';
import { AuthContext, api } from '../context/AuthContext';
import { Users, FileText, HardDrive, ShieldAlert, Trash2, ArrowLeftRight, Plus, X } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

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

const AdminDashboard = () => {
  const { user: currentUser } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    password: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load administrator data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleRole = (userObj) => {
    setConfirmConfig({
      title: userObj.role === 'admin' ? 'Remove Admin Rights' : 'Make Admin',
      message: `Are you sure you want to ${userObj.role === 'admin' ? 'remove admin rights from' : 'make an admin'} ${userObj.name}?`,
      confirmText: 'Confirm',
      confirmColor: 'bg-amber-500 hover:bg-amber-600',
      onConfirm: async () => {
        try {
          await api.put(`/api/admin/users/${userObj._id}/role`);
          fetchData();
        } catch (err) {
          console.error(err);
          alert(err.response?.data?.message || 'Failed to update user role');
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const handleDeleteUser = (userId) => {
    setConfirmConfig({
      title: 'Delete User',
      message: 'WARNING: Deleting a user will permanently remove their account AND all documents they have uploaded. Proceed?',
      confirmText: 'Delete',
      confirmColor: 'bg-rose-500 hover:bg-rose-600',
      onConfirm: async () => {
        try {
          await api.delete(`/api/admin/users/${userId}`);
          fetchData();
        } catch (err) {
          console.error(err);
          alert(err.response?.data?.message || 'Failed to delete user');
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/users', newAdmin);
      setNewAdmin({ name: '', email: '', password: '' });
      setShowCreateAdmin(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to create admin');
    }
  };

  const canModifyUser = (userObj) => {
    if (userObj.role === 'superadmin') return false;
    if (userObj._id === currentUser?._id) return false;
    if (currentUser?.role === 'admin' && userObj.role === 'admin') return false;
    return true;
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-sky-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 text-center">
        <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl p-4 inline-block text-left">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-8 w-8 text-amber-400" />
          <span>Admin Console</span>
        </h1>
        <p className="mt-2 text-slate-400">
          Monitor system metrics, review files, and manage registered accounts.
        </p>
      </div>

      <div className="mb-8 grid gap-6 sm:grid-cols-3">
        <div className="glass-panel p-6 rounded-2xl flex items-center space-x-4 border border-white/5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-white">
            <Users className="h-24 w-24" />
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400 text-left">Total Users</p>
            <p className="text-3xl font-bold text-white mt-1 text-left">{stats?.totalUsers || 0}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center space-x-4 border border-white/5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-white">
            <FileText className="h-24 w-24" />
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400 text-left">Total Documents</p>
            <p className="text-3xl font-bold text-white mt-1 text-left">{stats?.totalDocuments || 0}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center space-x-4 border border-white/5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-white">
            <HardDrive className="h-24 w-24" />
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-400 text-left">System Storage Used</p>
            <p className="text-3xl font-bold text-white mt-1 text-left">{formatBytes(stats?.totalStorage || 0)}</p>
          </div>
        </div>
      </div>

      <div className="mb-8 glass-panel p-6 rounded-2xl border border-white/5 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4 text-left">Document Category Distribution</h3>
        <div className="space-y-4">
          {Object.entries(stats?.categoryBreakdown || {}).map(([category, count]) => {
            const percentage = stats?.totalDocuments > 0 ? (count / stats.totalDocuments) * 100 : 0;
            
            let barColor = 'bg-sky-500';
            if (category === 'Invoice') barColor = 'bg-emerald-500';
            if (category === 'Contract') barColor = 'bg-violet-500';
            if (category === 'Resume') barColor = 'bg-rose-500';
            if (category === 'Report') barColor = 'bg-amber-500';

            return (
              <div key={category} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-300">{category}</span>
                  <span className="text-slate-400">{count} files ({percentage.toFixed(0)}%)</span>
                </div>
                <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Account Management</h3>
        {currentUser?.role === 'superadmin' && (
          <button
          onClick={() => setShowCreateAdmin(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Admin
        </button>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 shadow-xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-white/2">
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Registered</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-white/2 transition-colors text-sm text-slate-300">
                  <td className="px-6 py-4 font-semibold text-white text-left">{u.name}</td>
                  <td className="px-6 py-4 text-slate-400 text-left">{u.email}</td>
                  <td className="px-6 py-4 text-left">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                      u.role === 'superadmin' 
                        ? 'bg-red-500/10 text-red-400 border-red-500/25'
                        : u.role === 'admin' 
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' 
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/25'
                    }`}>
                      {getRoleDisplay(u.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-xs text-left">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {canModifyUser(u) ? (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleToggleRole(u)}
                          title={u.role === 'admin' ? 'Remove Admin Rights' : 'Make Admin'}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                        >
                          <ArrowLeftRight className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u._id)}
                          title="Delete account"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        {u._id === currentUser?._id ? 'Current User' : 'Cannot Modify'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {showCreateAdmin && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="glass-panel p-6 rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Create New Admin</h3>
              <button
                onClick={() => setShowCreateAdmin(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 text-white px-3 py-2 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAdmin(false)}
                  className="flex-1 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmConfig}
        onClose={() => setConfirmConfig(null)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        confirmColor={confirmConfig?.confirmColor}
        onConfirm={confirmConfig?.onConfirm}
      />
    </div>
  );
};
export default AdminDashboard;
