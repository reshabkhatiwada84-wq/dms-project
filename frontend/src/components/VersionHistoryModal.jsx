import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import {
  X, History, Download, RotateCcw, Trash2, CheckCircle2,
  Archive, Clock, User, HardDrive, AlertCircle, Upload, Loader2
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const formatBytes = (bytes, decimals = 1) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

const formatDate = (date) =>
  new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─── New Version Upload Mini-Form ────────────────────────────────────────────
const NewVersionUpload = ({ documentId, onSuccess, onCancel }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`/api/versions/${documentId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload new version');
      setUploading(false);
    }
  };

  return (
    <div className="border border-sky-500/20 bg-sky-500/5 rounded-xl p-4 mt-4 space-y-3">
      <p className="text-xs font-bold text-sky-400 uppercase tracking-wider">Upload New Version</p>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <input
        type="file"
        onChange={e => setFile(e.target.files[0])}
        className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-sky-500/15 file:text-sky-400 hover:file:bg-sky-500/25 cursor-pointer"
      />
      {file && <p className="text-[11px] text-slate-400">Selected: <span className="font-bold text-white">{file.name}</span> ({formatBytes(file.size)})</p>}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white border border-white/10 rounded-lg transition-colors">
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────
const VersionHistoryModal = ({ isOpen, onClose, document, onVersionChange }) => {
  const { user } = useContext(AuthContext);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // versionId being acted on
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [notification, setNotification] = useState('');

  const fetchVersions = async () => {
    if (!document) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`/api/versions/${document._id}`);
      setVersions(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && document) fetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, document]);

  const notify = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  const handleDownload = async (version) => {
    try {
      const response = await axios({
        url: `/api/versions/${document._id}/download/${version._id}`,
        method: 'GET',
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', version.originalName);
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch {
      setError('Failed to download this version');
    }
  };

  const handleRestore = async (version) => {
    if (!window.confirm(`Restore v${version.versionNumber}? This will make it the active version.`)) return;
    setActionLoading(version._id);
    try {
      await axios.post(`/api/versions/${document._id}/restore/${version._id}`);
      notify(`✓ Restored to v${version.versionNumber} successfully`);
      fetchVersions();
      if (onVersionChange) onVersionChange();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to restore version');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (version) => {
    const isLastVersion = versions.length <= 1;
    if (!window.confirm(`Delete v${version.versionNumber}?${isLastVersion ? ' This is the only version left — the entire document will be permanently removed.' : ' This cannot be undone.'}`)) return;
    setActionLoading(version._id);
    try {
      const res = await axios.delete(`/api/versions/${document._id}/${version._id}`);
      if (res.data.documentDeleted) {
        onClose();
        if (onVersionChange) onVersionChange();
      } else {
        notify(`v${version.versionNumber} deleted`);
        fetchVersions();
        if (onVersionChange) onVersionChange();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete version');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNewVersionSuccess = () => {
    setShowUploadForm(false);
    notify('✓ New version uploaded successfully');
    fetchVersions();
    if (onVersionChange) onVersionChange();
  };

  if (!isOpen || !document) return null;

  const isOwner = document.uploadedBy?._id === user?._id ||
    document.uploadedBy?.toString?.() === user?._id ||
    document.uploadedBy === user?._id;
  const canModify = user?.role === 'admin' || isOwner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Version History</h3>
              <p className="text-xs text-slate-400 truncate max-w-[300px]">{document.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className="mx-6 mt-3 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl px-4 py-2.5 text-sm font-semibold flex-shrink-0">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            {notification}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl px-4 py-2.5 text-sm flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Actions bar */}
        {canModify && (
          <div className="px-6 pt-4 flex-shrink-0">
            {!showUploadForm ? (
              <button
                onClick={() => setShowUploadForm(true)}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-xl hover:bg-sky-500/20 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload New Version
              </button>
            ) : (
              <NewVersionUpload
                documentId={document._id}
                onSuccess={handleNewVersionSuccess}
                onCancel={() => setShowUploadForm(false)}
              />
            )}
          </div>
        )}

        {/* Info bar */}
        <div className="px-6 py-3 flex items-center gap-4 text-[11px] text-slate-500 border-b border-white/5 flex-shrink-0">
          <span><span className="text-violet-400 font-bold">{versions.length}</span> version{versions.length !== 1 ? 's' : ''} stored</span>
        </div>

        {/* Version List */}
        <div className="overflow-y-auto flex-1 divide-y divide-white/5 px-6 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <History className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No versions yet</p>
              <p className="text-xs mt-1">Upload a new version to start tracking history</p>
            </div>
          ) : (
            versions.map((version, idx) => {
              const isActing = actionLoading === version._id;
              const isCurrent = version.isCurrentVersion;
              const expiresIn = Math.ceil((new Date(version.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
              const isExpiringSoon = expiresIn <= 2 && expiresIn > 0;

              return (
                <div
                  key={version._id}
                  className={`py-4 transition-colors ${isCurrent ? 'bg-gradient-to-r from-sky-500/5 to-transparent' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Version badge */}
                    <div className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl font-extrabold text-sm ${
                      isCurrent
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/25'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}>
                      v{version.versionNumber}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white">Version {version.versionNumber}</span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Latest
                          </span>
                        )}
                        {!isCurrent && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10">
                            <Archive className="h-3 w-3" /> Archived
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="h-3 w-3" /> Expires in {expiresIn}d
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(version.uploadDate)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="h-3 w-3" />
                          <span>{formatBytes(version.fileSize)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3" />
                          <span className="truncate">{version.uploadedBy?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="truncate">{version.originalName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Download */}
                      <button
                        onClick={() => handleDownload(version)}
                        title="Download this version"
                        disabled={isActing}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors disabled:opacity-40"
                      >
                        <Download className="h-4 w-4" />
                      </button>

                      {/* Restore (only for non-current versions) */}
                      {canModify && !isCurrent && (
                        <button
                          onClick={() => handleRestore(version)}
                          title="Restore this version"
                          disabled={isActing}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                        >
                          {isActing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </button>
                      )}

                      {/* Delete */}
                      {canModify && (
                        <button
                          onClick={() => handleDelete(version)}
                          title="Delete this version"
                          disabled={isActing}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                        >
                          {isActing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Action log (last event) */}
                  {version.actionLog && version.actionLog.length > 1 && (
                    <div className="mt-2 ml-14 text-[10px] text-slate-600">
                      Last action: <span className="capitalize text-slate-500">{version.actionLog[version.actionLog.length - 1]?.action}</span>
                      {' '}by {version.actionLog[version.actionLog.length - 1]?.performedBy?.name || 'System'}
                      {' '}· {formatDate(version.actionLog[version.actionLog.length - 1]?.performedAt)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-white/5 flex-shrink-0">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-300 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;
