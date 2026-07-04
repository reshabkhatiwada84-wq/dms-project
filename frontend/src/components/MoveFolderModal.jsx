import React, { useState } from 'react';
import { api } from '../context/AuthContext';
import { FolderOpen, X, Check } from 'lucide-react';

/**
 * MoveFolderModal
 * Props:
 *  - isOpen
 *  - onClose
 *  - document: the document being moved
 *  - folders: array of { _id, name }
 *  - onSuccess(): called after successful move
 */
const MoveFolderModal = ({ isOpen, onClose, document, folders, onSuccess }) => {
  const [selectedId, setSelectedId] = useState(document?.folder?._id || document?.folder || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !document) return null;

  const handleMove = async () => {
    setSaving(true);
    setError('');
    try {
      await api.put(`/api/documents/${document._id}/folder`, {
        folderId: selectedId || null,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to move document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm glass-panel rounded-2xl shadow-2xl overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Move to Folder</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-slate-400">
            Moving: <span className="font-semibold text-white">{document.title}</span>
          </p>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* No folder option */}
          <button
            onClick={() => setSelectedId('')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              selectedId === ''
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FolderOpen className="h-4 w-4 flex-shrink-0" />
            <span>No folder</span>
            {selectedId === '' && <Check className="h-4 w-4 ml-auto text-sky-400" />}
          </button>

          {/* Folder options */}
          {folders.map(folder => (
            <button
              key={folder._id}
              onClick={() => setSelectedId(folder._id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                selectedId === folder._id
                  ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                  : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{folder.name}</span>
              {selectedId === folder._id && <Check className="h-4 w-4 ml-auto text-sky-400" />}
            </button>
          ))}

          {folders.length === 0 && (
            <p className="text-center text-xs text-slate-500 py-3">No folders created yet. Create one from the sidebar first.</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white border border-white/5 hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition-all disabled:opacity-50"
          >
            {saving ? 'Moving...' : 'Move Here'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveFolderModal;
