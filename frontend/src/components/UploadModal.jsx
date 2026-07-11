import React, { useState, useEffect } from 'react';
import { api } from '../context/AuthContext';

import { UploadCloud, X, Folder, Plus } from 'lucide-react';

const UploadModal = ({ isOpen, onClose, onUploadSuccess, folders = [], defaultFolderId = '' }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Invoice');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [availableCategories, setAvailableCategories] = useState(['Invoice', 'Contract', 'Resume', 'Report']);
  const [folderId, setFolderId] = useState(defaultFolderId);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Sync defaultFolderId whenever the modal opens or the prop changes
  useEffect(() => {
    if (isOpen) {
      setFolderId(defaultFolderId);
      setDragActive(false);
      // Fetch available categories
      api.get('/api/documents/categories')
        .then(res => {
          if (res.data && res.data.length > 0) {
            setAvailableCategories(res.data);
          }
        })
        .catch(err => console.error('Failed to fetch categories:', err));
    }
  }, [defaultFolderId, isOpen]);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);


  if (!isOpen) return null;

  const clearFile = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFile(null);
    setTitle(''); // clear old title so next file's name auto-fills correctly
    // Reset the hidden <input type="file"> so the same file can be chosen again
    const input = document.getElementById('file-upload');
    if (input) input.value = '';
  };

  const setSelectedFile = (selected) => {
    if (!selected) return;
    setFile(selected);
    if (!title) {
      const name = selected.name.replace(/\.[^/.]+$/, "");
      setTitle(name);
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only deactivate when leaving the drop zone itself, not child elements
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) setSelectedFile(dropped);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);

    try {
      const res = await api.post('/api/documents/upload', formData);

      // If a folder was selected, assign the document to it
      if (folderId && res.data?._id) {
        await api.put(`/api/documents/${res.data._id}/folder`, { folderId });
      }

      setUploading(false);
      setTitle('');
      setDescription('');
      setCategory('Invoice');
      setCustomCategory('');
      setIsCustomCategory(false);
      setFolderId(defaultFolderId);
      setFile(null);
      onUploadSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error uploading file');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg glass-panel rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] border border-white/10 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-bold text-white">Upload New Document</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-lg p-3 text-sm text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <label
            htmlFor="file-upload"
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-6 transition-all flex flex-col items-center justify-center bg-slate-900/30 cursor-pointer ${
              dragActive
                ? 'border-sky-400 bg-sky-500/10 scale-[1.01] shadow-lg shadow-sky-500/20'
                : 'border-white/10 hover:border-sky-500/50'
            }`}
          >
            <UploadCloud
              className={`h-10 w-10 mb-2 transition-colors ${
                dragActive ? 'text-sky-400' : 'text-slate-400'
              }`}
            />
            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              className="hidden"
            />
            <span
              className={`text-sm font-semibold transition-colors ${
                dragActive ? 'text-sky-300' : 'text-sky-400'
              }`}
            >
              {dragActive ? 'Drop file to upload' : 'Click or drag & drop a file'}
            </span>
            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
              PDF, DOC, DOCX, Images — up to 20 MB
            </p>
            {file && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-300 bg-white/5 pl-3 pr-1.5 py-1.5 rounded-full border border-white/10">
                <span className="truncate max-w-[220px]">
                  Selected: <span className="font-bold text-white">{file.name}</span>
                  <span className="text-slate-400 ml-1">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </span>
                <button
                  type="button"
                  onClick={clearFile}
                  title="Remove selected file"
                  className="flex-shrink-0 ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-rose-500/20 hover:bg-rose-500/50 text-rose-400 hover:text-white transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </label>

          <div>
            <label htmlFor="doc-title" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Document Title
            </label>
            <input
              type="text"
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass-input mt-1 block w-full rounded-xl py-3 px-3 text-sm"
              placeholder="e.g. Q4 Financial Report"
              required
            />
          </div>

          <div>
            <label htmlFor="doc-category" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Category
            </label>
            <select
              id="doc-category"
              value={isCustomCategory ? '__custom__' : category}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIsCustomCategory(true);
                  setCategory('');
                } else {
                  setIsCustomCategory(false);
                  setCategory(e.target.value);
                  setCustomCategory('');
                }
              }}
              className="glass-input mt-1 block w-full rounded-xl py-3 px-3 text-sm bg-slate-900 cursor-pointer"
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="__custom__">＋ New Category...</option>
            </select>
            {isCustomCategory && (
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Plus className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => {
                    setCustomCategory(e.target.value);
                    setCategory(e.target.value);
                  }}
                  className="glass-input block w-full rounded-xl py-2.5 pl-9 pr-3 text-sm"
                  placeholder="Type your custom category name..."
                  autoFocus
                  required
                />
              </div>
            )}
          </div>

          {/* Folder selector */}
          <div>
            <label htmlFor="doc-folder" className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5 text-violet-400" />
              Save to Folder (Optional)
            </label>
            <select
              id="doc-folder"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="glass-input mt-1 block w-full rounded-xl py-3 px-3 text-sm bg-slate-900 cursor-pointer"
            >
              <option value="">— No folder —</option>
              {folders.map(f => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="doc-desc" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Description (Optional)
            </label>
            <textarea
              id="doc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className="glass-input mt-1 block w-full rounded-xl py-3 px-3 text-sm"
              placeholder="Provide a brief summary of the file content..."
            ></textarea>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors border border-white/5 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:brightness-110 transition-all disabled:opacity-50"
            >
              {uploading ? 'Uploading File...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default UploadModal;
