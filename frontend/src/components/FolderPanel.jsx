import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../context/AuthContext';
import { Folder, FolderOpen, FolderPlus, Pencil, Trash2, X, Check } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

/**
 * FolderPanel
 * Props:
 *  - folders: array of folder objects { _id, name }
 *  - selectedFolder: currently selected folder id, or 'all' or 'none'
 *  - onSelectFolder(id): called when user clicks a folder item
 *  - onFoldersChange(): called after any mutation (create/rename/delete)
 */
const FolderPanel = ({ folders, selectedFolder, onSelectFolder, onFoldersChange }) => {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);

  // ── Create ────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/api/folders', { name: newName.trim() });
      setNewName('');
      setCreating(false);
      onFoldersChange();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create folder');
    } finally {
      setSaving(false);
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────
  const startRename = (folder) => {
    setRenamingId(folder._id);
    setRenameValue(folder.name);
    setError('');
  };

  const handleRename = async (id) => {
    if (!renameValue.trim()) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/api/folders/${id}`, { name: renameValue.trim() });
      setRenamingId(null);
      setRenameValue('');
      onFoldersChange();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to rename folder');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (id) => {
    setConfirmConfig({
      title: 'Delete Folder',
      message: 'Delete this folder? Documents inside will become unorganized.',
      confirmText: 'Delete',
      confirmColor: 'bg-rose-500 hover:bg-rose-600',
      onConfirm: async () => {
        setError('');
        try {
          await api.delete(`/api/folders/${id}`);
          if (selectedFolder === id) onSelectFolder('all');
          onFoldersChange();
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to delete folder');
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const navItems = [
    { id: 'all', label: 'All Documents', icon: FolderOpen },
  ];

  return (
    <div className="w-56 flex-shrink-0 glass-panel rounded-2xl border border-white/5 shadow-xl p-3 h-fit">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Folders</span>
        <button
          onClick={() => { setCreating(true); setError(''); }}
          title="New Folder"
          className="p-1 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-1.5 mb-2">{error}</p>
      )}

      {/* Static nav items */}
      <div className="space-y-0.5 mb-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onSelectFolder(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              selectedFolder === item.id
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </button>
        ))}

        {/* Trash link */}
        <Link
          to="/trash"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
        >
          <Trash2 className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">Trash</span>
        </Link>
      </div>

      {/* Divider */}
      {folders.length > 0 && <div className="border-t border-white/5 mb-2" />}

      {/* User folders */}
      <div className="space-y-0.5">
        {folders.map(folder => (
          <div key={folder._id} className="group flex items-center gap-1">
            {renamingId === folder._id ? (
              <div className="flex items-center gap-1 w-full px-1">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(folder._id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="glass-input flex-1 rounded-lg py-1 px-2 text-xs"
                />
                <button
                  onClick={() => handleRename(folder._id)}
                  disabled={saving}
                  className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setRenamingId(null)}
                  className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onSelectFolder(folder._id)}
                  className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all min-w-0 ${
                    selectedFolder === folder._id
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Folder className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </button>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => startRename(folder)}
                    title="Rename"
                    className="p-1 rounded text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(folder._id)}
                    title="Delete"
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Create new folder input */}
      {creating && (
        <div className="mt-2 border-t border-white/5 pt-2">
          <div className="flex items-center gap-1 px-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
              }}
              placeholder="Folder name..."
              className="glass-input flex-1 rounded-lg py-1 px-2 text-xs"
            />
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(''); setError(''); }}
              className="p-1 rounded text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
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

export default FolderPanel;
