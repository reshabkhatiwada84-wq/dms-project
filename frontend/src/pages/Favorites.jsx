import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../context/AuthContext';
import PreviewModal from '../components/PreviewModal';
import VersionHistoryModal from '../components/VersionHistoryModal';
import ShareModal from '../components/ShareModal';
import ConfirmModal from '../components/ConfirmModal';
import MoveFolderModal from '../components/MoveFolderModal';
import {
  Download, FileText, Search, Trash2, AlertCircle,
  FolderOpen, Share2, History, Star, StarOff, FolderInput
} from 'lucide-react';

const Favorites = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [confirmConfig, setConfirmConfig] = useState(null);

  // Folder state
  const [folders, setFolders] = useState([]);
  const [moveDoc, setMoveDoc] = useState(null);
  const [isMoveOpen, setIsMoveOpen] = useState(false);

  // Share state
  const [shareDoc, setShareDoc] = useState(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Version History state
  const [versionDoc, setVersionDoc] = useState(null);
  const [isVersionOpen, setIsVersionOpen] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [viewMode, setViewMode] = useState('grid');

  const [categories, setCategories] = useState(['All', 'Invoice', 'Contract', 'Resume', 'Report']);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/api/documents/categories');
      if (res.data && res.data.length > 0) {
        setCategories(['All', ...res.data]);
      }
    } catch (err) {
      console.error('Categories fetch error:', err);
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { search, category: selectedCategory, favoritesOnly: true };
      const res = await api.get('/api/documents', { params });
      setDocuments(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch favorites. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const t = setTimeout(fetchFavorites, 300);
    return () => clearTimeout(t);
  }, [fetchFavorites]);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await api.get('/api/folders');
      setFolders(res.data);
    } catch (err) {
      console.error('Folders fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const handleToggleFavorite = async (e, doc) => {
    e.stopPropagation();
    try {
      const res = await api.put(`/api/documents/${doc._id}/favorite`);
      const { isFavorite, message } = res.data;
      
      showToast(message);
      
      // Update local state: remove from list since this is the Favorites page
      if (!isFavorite) {
        setDocuments(prev => prev.filter(d => d._id !== doc._id));
      } else {
        fetchFavorites();
      }
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      alert('Failed to update favorite status');
    }
  };

  const handleDelete = async (id) => {
    setConfirmConfig({
      title: 'Delete Document',
      message: 'Are you sure you want to move this document to trash?',
      confirmText: 'Delete',
      confirmColor: 'bg-rose-500 hover:bg-rose-600',
      onConfirm: async () => {
        try {
          await api.delete(`/api/documents/${id}`);
          fetchFavorites();
        } catch (err) {
          alert(err.response?.data?.message || 'Failed to delete document');
        } finally {
          setConfirmConfig(null);
        }
      }
    });
  };

  const handleDownload = async (id, originalName) => {
    try {
      const response = await api({ url: `/api/documents/download/${id}`, method: 'GET', responseType: 'blob' });
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

  const handleOpenMove = (e, doc) => {
    e.stopPropagation();
    setMoveDoc(doc);
    setIsMoveOpen(true);
  };

  const handleShare = (doc) => {
    setShareDoc(doc);
    setIsShareOpen(true);
  };

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-in fade-in duration-300 relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center space-x-3 animate-in slide-in-from-bottom-5">
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <Star className="h-8 w-8 text-yellow-400 fill-yellow-400" />
          My Favorites
        </h1>
        <p className="mt-1.5 text-slate-400 text-sm">
          Quickly access your most important documents.
        </p>
      </div>

      <div className="flex-1 min-w-0">
        {/* Search & Filter */}
        <div className="mb-6 space-y-4">
          <div className="relative max-w-xl">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Search favorites..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input block w-full rounded-xl py-3 pl-12 pr-4 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-4 gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition-all ${
                    selectedCategory === cat
                      ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/20'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* View Toggle */}
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                title="Grid View"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                title="List View"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center space-x-2 bg-rose-500/15 border border-rose-500/30 text-rose-300 rounded-xl p-4 max-w-xl">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-sky-500" />
          </div>
        ) : documents.length === 0 ? (
          <div className="glass-panel flex flex-col items-center justify-center rounded-2xl py-16 px-4 text-center max-w-3xl mx-auto">
            <StarOff className="h-16 w-16 text-slate-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-1">No favorite files yet.</h3>
            <p className="text-slate-400 max-w-sm text-sm">
              You haven't marked any documents as favorites. Click the star icon on a document to add it here.
            </p>
          </div>
        ) : (
          <>
            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {documents.map((doc) => {
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
                          </div>
                          <button 
                            onClick={(e) => handleToggleFavorite(e, doc)} 
                            className="text-yellow-400 hover:text-slate-400 transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-full border border-white/5"
                            title="Remove from Favorites"
                          >
                            <Star className="h-4 w-4 fill-yellow-400" />
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
                      </div>
                      {/* ── Action Toolbar ── */}
                      <div className="border-t border-white/5 mt-3 pt-3 flex flex-wrap gap-2 items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleDownload(doc._id, doc.originalName); }}
                            title="Download" className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 transition-colors">
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Download</span>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleShare(doc); }}
                            title="Share" className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                            <Share2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Share</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setVersionDoc(doc); setIsVersionOpen(true); }}
                            title="Version History" className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                            <History className="h-4 w-4" />
                          </button>
                          <button onClick={(e) => handleOpenMove(e, doc)}
                            title="Move to Folder" className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                            <FolderInput className="h-4 w-4" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(doc._id); }}
                            title="Delete" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {documents.map((doc) => {
                  return (
                    <div
                      key={doc._id}
                      onClick={() => { setSelectedPreviewDoc(doc); setIsPreviewOpen(true); }}
                      className="glass-card flex items-center gap-4 p-4 rounded-2xl relative overflow-hidden group cursor-pointer"
                    >
                      {/* Icon */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 flex-shrink-0">
                        <FileText className="h-6 w-6" />
                      </div>
                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="text-sm font-bold text-white group-hover:text-sky-400 transition-colors truncate">{doc.title}</h4>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getCategoryColor(doc.category)}`}>
                            {doc.category}
                          </span>
                          {doc.folder && (
                            <div className="flex items-center gap-1">
                              <FolderOpen className="h-3 w-3 text-violet-400" />
                              <span className="text-[10px] text-violet-400 font-semibold truncate">{doc.folder.name}</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate">{doc.description || 'No description provided.'}</p>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                          <span>Size: <span className="font-semibold text-slate-300">{formatBytes(doc.size)}</span></span>
                          <span>Uploaded: <span className="font-semibold text-slate-300">{new Date(doc.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span></span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button 
                          onClick={(e) => handleToggleFavorite(e, doc)} 
                          className="text-yellow-400 hover:text-slate-400 transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-full border border-white/5"
                          title="Remove from Favorites"
                        >
                          <Star className="h-4 w-4 fill-yellow-400" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDownload(doc._id, doc.originalName); }}
                          title="Download" className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors">
                          <Download className="h-4 w-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleShare(doc); }}
                          title="Share" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setVersionDoc(doc); setIsVersionOpen(true); }}
                          title="Version History" className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                          <History className="h-4 w-4" />
                        </button>
                        <button onClick={(e) => handleOpenMove(e, doc)}
                          title="Move to Folder" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                          <FolderInput className="h-4 w-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(doc._id); }}
                          title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={!!confirmConfig}
        onClose={() => setConfirmConfig(null)}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        confirmText={confirmConfig?.confirmText || 'Confirm'}
        confirmColor={confirmConfig?.confirmColor}
      />

      {isPreviewOpen && selectedPreviewDoc && (
        <PreviewModal
          isOpen={isPreviewOpen}
          onClose={() => { setIsPreviewOpen(false); setSelectedPreviewDoc(null); }}
          document={selectedPreviewDoc}
        />
      )}

      {isShareOpen && shareDoc && (
        <ShareModal
          isOpen={isShareOpen}
          onClose={() => { setIsShareOpen(false); setShareDoc(null); }}
          document={shareDoc}
        />
      )}

      {isVersionOpen && versionDoc && (
        <VersionHistoryModal
          isOpen={isVersionOpen}
          onClose={() => { setIsVersionOpen(false); setVersionDoc(null); }}
          document={versionDoc}
        />
      )}

      {isMoveOpen && moveDoc && (
        <MoveFolderModal
          isOpen={isMoveOpen}
          onClose={() => { setIsMoveOpen(false); setMoveDoc(null); }}
          document={moveDoc}
          folders={folders}
          onSuccess={() => { fetchFavorites(); setIsMoveOpen(false); setMoveDoc(null); }}
        />
      )}
    </div>
  );
};

export default Favorites;
