import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import UploadModal from '../components/UploadModal';
import PreviewModal from '../components/PreviewModal';
import MoveFolderModal from '../components/MoveFolderModal';
import VersionHistoryModal from '../components/VersionHistoryModal';
import ShareModal from '../components/ShareModal';
import ConfirmModal from '../components/ConfirmModal';
import {
  Star, FileText, Download, Trash2, Share2, FolderInput, History, FolderOpen,
} from 'lucide-react';

// ─── Toast Notification ────────────────────────────────────────────────────────
const Toast = ({ message, visible }) => (
  <div
    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-slate-800 border border-white/10 shadow-2xl text-sm font-semibold text-white transition-all duration-300 ${
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
    }`}
  >
    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
    {message}
  </div>
);

const FavoritesPage = () => {
  const { user } = useContext(AuthContext);
  const [favorites, setFavorites] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState([]);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [shareDoc, setShareDoc] = useState(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [moveDoc, setMoveDoc] = useState(null);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [versionDoc, setVersionDoc] = useState(null);
  const [isVersionOpen, setIsVersionOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);

  // ── Toast state ─────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ visible: false, message: '' });

  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 2500);
  };

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/favorites');
      setFavorites(res.data);
      setFavoriteIds(new Set(res.data.map((d) => d._id)));
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await axios.get('/api/folders');
      setFolders(res.data);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
    fetchFolders();
  }, [fetchFavorites, fetchFolders]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleToggleFavorite = async (e, docId) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`/api/favorites/${docId}`);
      if (!res.data.isFavorite) {
        // Removed from favorites → remove from list instantly
        setFavorites((prev) => prev.filter((d) => d._id !== docId));
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
        showToast('Removed from Favorites');
      } else {
        showToast('Added to Favorites');
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDownload = async (id, originalName) => {
    try {
      const response = await axios({ url: `/api/documents/download/${id}`, method: 'GET', responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert('Failed to download file');
    }
  };

  const handleDelete = async (id) => {
    setConfirmConfig({
      title: 'Delete Document',
      message: 'Are you sure you want to delete this document?',
      confirmText: 'Delete',
      confirmColor: 'bg-rose-500 hover:bg-rose-600',
      onConfirm: async () => {
        try {
          await axios.delete(`/api/documents/${id}`);
          fetchFavorites();
        } catch (err) {
          alert(err.response?.data?.message || 'Failed to delete document');
        } finally {
          setConfirmConfig(null);
        }
      },
    });
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const formatBytes = (bytes, decimals = 1) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Invoice': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'Contract': return 'bg-violet-500/10 text-violet-400 border-violet-500/25';
      case 'Resume': return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
      case 'Report': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      default: return 'bg-sky-500/10 text-sky-400 border-sky-500/25';
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      {/* ── Header ── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Favorites</h1>
          </div>
          <p className="mt-1 text-slate-400 text-sm pl-1">
            Your starred documents — quick access to what matters most.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-sm text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              {favorites.length} {favorites.length === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-amber-500" />
        </div>
      ) : favorites.length === 0 ? (
        /* ── Empty State ── */
        <div className="glass-panel flex flex-col items-center justify-center rounded-2xl py-24 px-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 mb-5">
            <Star className="h-10 w-10 text-amber-400/40" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No favorite files yet</h3>
          <p className="text-slate-400 max-w-sm text-sm">
            Click the <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-400" /></span> star icon on any document to add it to your favorites for quick access.
          </p>
        </div>
      ) : (
        /* ── Document Grid ── */
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {favorites.map((doc) => {
            const isFav = favoriteIds.has(doc._id);
            return (
              <div
                key={doc._id}
                onClick={() => { setSelectedPreviewDoc(doc); setIsPreviewOpen(true); }}
                className="glass-card flex flex-col justify-between p-6 rounded-2xl relative overflow-hidden group cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                        <FileText className="h-6 w-6" />
                      </div>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(doc.category)}`}>
                        {doc.category}
                      </span>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider bg-slate-500/10 text-slate-300 border-slate-500/25">
                        {doc.originalName?.split('.').pop().toUpperCase() || 'FILE'}
                      </span>
                    </div>
                    {/* Star button — top-right */}
                    <button
                      onClick={(e) => handleToggleFavorite(e, doc._id)}
                      title="Remove from Favorites"
                      className="p-1.5 rounded-lg transition-colors text-amber-400 hover:bg-amber-500/10"
                    >
                      <Star className={`h-4 w-4 ${isFav ? 'fill-amber-400' : ''}`} />
                    </button>
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-sky-400 transition-colors truncate mb-1">{doc.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-2 h-8">{doc.description || 'No description provided.'}</p>
                  {doc.folder && (
                    <div className="flex items-center gap-1 mb-2">
                      <FolderOpen className="h-3 w-3 text-violet-400" />
                      <span className="text-[10px] text-violet-400 font-semibold truncate">{doc.folder.name}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/5 pt-3 mt-2 text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Size:</span>
                    <span className="font-semibold text-slate-300">{formatBytes(doc.size)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Uploaded:</span>
                    <span className="font-semibold text-slate-300">
                      {new Date(doc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {user?.role === 'admin' && (
                    <div className="flex justify-between border-t border-white/5 pt-1 mt-1 text-[10px]">
                      <span>Uploaded By:</span>
                      <span className="text-amber-400 truncate max-w-[150px] font-bold">{doc.uploadedBy?.name || 'Unknown'}</span>
                    </div>
                  )}
                </div>

                {/* ── Action Toolbar ── */}
                <div className="border-t border-white/5 mt-3 pt-3 flex flex-wrap gap-2 items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(doc._id, doc.originalName); }}
                      title="Download"
                      className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Download</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShareDoc(doc); setIsShareOpen(true); }}
                      title="Share"
                      className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Share</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setVersionDoc(doc); setIsVersionOpen(true); }}
                      title="Version History"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMoveDoc(doc); setIsMoveOpen(true); }}
                      title="Move to Folder"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                    >
                      <FolderInput className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc._id); }}
                      title="Delete"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      <ConfirmModal
        isOpen={!!confirmConfig}
        onClose={() => setConfirmConfig(null)}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        confirmText={confirmConfig?.confirmText}
        confirmColor={confirmConfig?.confirmColor}
        onConfirm={confirmConfig?.onConfirm}
      />
      <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} document={shareDoc} />
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={fetchFavorites}
        folders={folders}
        defaultFolderId=""
      />
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => { setIsPreviewOpen(false); setSelectedPreviewDoc(null); }}
        document={selectedPreviewDoc}
      />
      <MoveFolderModal
        isOpen={isMoveOpen}
        onClose={() => { setIsMoveOpen(false); setMoveDoc(null); }}
        document={moveDoc}
        folders={folders}
        onSuccess={fetchFavorites}
      />
      <VersionHistoryModal
        isOpen={isVersionOpen}
        onClose={() => { setIsVersionOpen(false); setVersionDoc(null); }}
        document={versionDoc}
        onVersionChange={fetchFavorites}
      />

      {/* ── Toast ── */}
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default FavoritesPage;
