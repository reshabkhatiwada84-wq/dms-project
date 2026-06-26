import React, { useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Trash2, FileText, RotateCcw, AlertTriangle, Archive, FileX, ArrowLeft, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const TRASH_RETENTION_DAYS = 15;

// Returns the number of days remaining before auto-purge (< 0 means expired)
const daysRemaining = (deletedAt) => {
  if (!deletedAt) return TRASH_RETENTION_DAYS;
  const elapsedMs = Date.now() - new Date(deletedAt).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays));
};

const TrashView = () => {
  const { user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('documents');
  const [deletedDocs, setDeletedDocs] = useState([]);
  const [deletedVersions, setDeletedVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'doc'|'ver', id, name }

  const fetchDeletedDocs = useCallback(async () => {
    try {
      const res = await axios.get('/api/trash/documents');
      setDeletedDocs(res.data);
    } catch (err) {
      console.error('Failed to fetch deleted documents:', err);
    }
  }, []);

  const fetchDeletedVersions = useCallback(async () => {
    try {
      const res = await axios.get('/api/trash/versions');
      setDeletedVersions(res.data);
    } catch (err) {
      console.error('Failed to fetch deleted versions:', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDeletedDocs(), fetchDeletedVersions()]).finally(() => setLoading(false));
  }, [fetchDeletedDocs, fetchDeletedVersions]);

  // ── Restore Document ─────────────────────────────────────────────────────
  const handleRestoreDoc = async (id) => {
    try {
      await axios.post(`/api/trash/documents/${id}/restore`);
      setDeletedDocs((prev) => prev.filter((d) => d._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to restore document');
    }
  };

  // ── Restore Version ──────────────────────────────────────────────────────
  const handleRestoreVersion = async (id) => {
    try {
      await axios.post(`/api/trash/versions/${id}/restore`);
      setDeletedVersions((prev) => prev.filter((v) => v._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to restore version');
    }
  };

  // ── Permanent Delete ─────────────────────────────────────────────────────
  const handlePermanentDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'doc') {
        await axios.delete(`/api/trash/documents/${confirmDelete.id}`);
        setDeletedDocs((prev) => prev.filter((d) => d._id !== confirmDelete.id));
      } else {
        await axios.delete(`/api/trash/versions/${confirmDelete.id}`);
        setDeletedVersions((prev) => prev.filter((v) => v._id !== confirmDelete.id));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to permanently delete');
    } finally {
      setConfirmDelete(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400 text-sm">Loading trash...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/20">
              <Trash2 className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Trash</h1>
              <p className="text-xs text-slate-500">Deleted documents and versions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/5">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium transition-all border-b-2 ${
            activeTab === 'documents'
              ? 'text-rose-400 border-rose-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <Archive className="h-4 w-4" />
          <span>Deleted Documents</span>
          {deletedDocs.length > 0 && (
            <span className="text-[10px] bg-rose-500/15 text-rose-400 px-1.5 py-0.5 rounded-full font-bold">
              {deletedDocs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium transition-all border-b-2 ${
            activeTab === 'versions'
              ? 'text-rose-400 border-rose-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <FileX className="h-4 w-4" />
          <span>Deleted Versions</span>
          {deletedVersions.length > 0 && (
            <span className="text-[10px] bg-rose-500/15 text-rose-400 px-1.5 py-0.5 rounded-full font-bold">
              {deletedVersions.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          {deletedDocs.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-white/5 p-12 text-center">
              <Trash2 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No deleted documents</p>
            </div>
          ) : (
            deletedDocs.map((doc) => (
              <div
                key={doc._id}
                className="glass-panel rounded-2xl border border-white/5 p-4 flex items-center justify-between hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/50 border border-white/5 flex-shrink-0">
                    <FileText className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{doc.title}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                      <span>{doc.versionCount} version{doc.versionCount !== 1 ? 's' : ''}</span>
                      <span>·</span>
                      <span>Deleted {formatDate(doc.deletedAt)}</span>
                      {doc.deletedBy && (
                        <>
                          <span>·</span>
                          <span>by {doc.deletedBy.name}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="text-slate-400">{doc.category}</span>
                      <span>·</span>
                      <span
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                          daysRemaining(doc.deletedAt) <= 3
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                        title={`Items in trash are permanently deleted after ${TRASH_RETENTION_DAYS} days`}
                      >
                        <Clock className="h-3 w-3" />
                        {daysRemaining(doc.deletedAt)} day{daysRemaining(doc.deletedAt) !== 1 ? 's' : ''} left
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handleRestoreDoc(doc._id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/30 transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() =>
                      setConfirmDelete({
                        type: 'doc',
                        id: doc._id,
                        name: doc.title,
                      })
                    }
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 hover:border-rose-500/30 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Forever</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'versions' && (
        <div className="space-y-3">
          {deletedVersions.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-white/5 p-12 text-center">
              <Trash2 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No deleted versions</p>
            </div>
          ) : (
            deletedVersions.map((ver) => (
              <div
                key={ver._id}
                className="glass-panel rounded-2xl border border-white/5 p-4 flex items-center justify-between hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800/50 border border-white/5 flex-shrink-0">
                    <FileX className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {ver.documentId?.title || 'Unknown Document'}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                      <span className="text-sky-400 font-medium">v{ver.versionNumber}</span>
                      <span>·</span>
                      <span>Deleted {formatDate(ver.deletedAt)}</span>
                      {ver.deletedBy && (
                        <>
                          <span>·</span>
                          <span>by {ver.deletedBy.name}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{ver.originalName}</span>
                      <span>·</span>
                      <span
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                          daysRemaining(ver.deletedAt) <= 3
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                        title={`Items in trash are permanently deleted after ${TRASH_RETENTION_DAYS} days`}
                      >
                        <Clock className="h-3 w-3" />
                        {daysRemaining(ver.deletedAt)} day{daysRemaining(ver.deletedAt) !== 1 ? 's' : ''} left
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <button
                    onClick={() => handleRestoreVersion(ver._id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/30 transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() =>
                      setConfirmDelete({
                        type: 'ver',
                        id: ver._id,
                        name: `v${ver.versionNumber} of ${ver.documentId?.title || 'Unknown'}`,
                      })
                    }
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 hover:border-rose-500/30 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Forever</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel rounded-2xl border border-white/10 shadow-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/20">
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Permanently Delete?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-6">
              Are you sure you want to permanently delete <span className="font-semibold text-white">{confirmDelete.name}</span>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="text-xs font-medium text-slate-400 hover:text-white px-4 py-2 rounded-xl border border-white/5 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                className="text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 px-4 py-2 rounded-xl transition-all"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrashView;
